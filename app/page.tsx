"use client";
import { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, Share2, X } from "lucide-react";
import {
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

const App = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [channelName, setChannelName] = useState("");
  const localTrackRef = useRef<{
    videoTrack: ICameraVideoTrack | null;
    audioTrack: IMicrophoneAudioTrack | null;
  }>({
    videoTrack: null,
    audioTrack: null,
  });
  const [users, setUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);

  const agoraAppID = process.env.NEXT_PUBLIC_AGORA_APPID;
  const agoraToken = process.env.NEXT_PUBLIC_AGORA_TOKEN;

  useEffect(() => {
    if (!isInCall) return;

    const init = async () => {
      client.on("user-published", handleUserPublished);
      client.on("user-unpublished", handleUserUnpublished);

      try {
        if (!agoraAppID) throw new Error("Agora App ID is required");
        await client.join(agoraAppID, channelName, agoraToken || null);

        const [audioTrack, videoTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack(),
          AgoraRTC.createCameraVideoTrack(),
        ]);

        await client.publish([audioTrack, videoTrack]);
        localTrackRef.current = { audioTrack, videoTrack };

        videoTrack.play("local-user");
      } catch (error) {
        console.error("Failed to initialize call:", error);
        setIsInCall(false);
      }
    };

    init();

    return () => {
      const { audioTrack, videoTrack } = localTrackRef.current;
      audioTrack?.close();
      videoTrack?.close();
      client.removeAllListeners();
      client.leave().catch(console.error);
    };
  }, [isInCall, agoraAppID, agoraToken, channelName]);

  const handleUserPublished = async (
    user: IAgoraRTCRemoteUser,
    mediaType: "audio" | "video"
  ) => {
    try {
      await client.subscribe(user, mediaType);

      if (mediaType === "video") {
        setUsers((prev) => {
          if (prev.find((u) => u.uid === user.uid)) {
            return prev;
          }
          return [...prev, user];
        });
        user.videoTrack?.play(`user-${user.uid}`);
      }

      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    } catch (error) {
      console.error("Failed to subscribe to user:", error);
    }
  };

  const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
    client.unsubscribe(user).catch(console.error);
    setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
  };

  const toggleVideo = async () => {
    const { videoTrack } = localTrackRef.current;
    if (videoTrack) {
      try {
        await videoTrack.setEnabled(!isVideoOn);
        setIsVideoOn(!isVideoOn);
      } catch (error) {
        console.error("Failed to toggle video:", error);
      }
    }
  };

  const toggleAudio = async () => {
    const { audioTrack } = localTrackRef.current;
    if (audioTrack) {
      try {
        await audioTrack.setEnabled(!isAudioOn);
        setIsAudioOn(!isAudioOn);
      } catch (error) {
        console.error("Failed to toggle audio:", error);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      if (!screenTrack) {
        const track = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p",
        });
        await client.publish(track);
        setScreenTrack(track);
        track.play("screen-share");
      } else {
        await client.unpublish(screenTrack);
        screenTrack.close();
        setScreenTrack(null);
      }
    } catch (error) {
      console.error("Failed to toggle screen share:", error);
    }
  };

  const leaveChannel = async () => {
    try {
      const { audioTrack, videoTrack } = localTrackRef.current;
      audioTrack?.close();
      videoTrack?.close();
      await client.leave();
      setIsInCall(false);
      setUsers([]);
      localTrackRef.current = { audioTrack: null, videoTrack: null };
    } catch (error) {
      console.error("Failed to leave channel:", error);
    }
  };

  const VideoGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 h-[calc(100vh-100px)]">
      <div
        id="local-user"
        className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video"
      />
      {screenTrack && (
        <div
          id="screen-share"
          className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video"
        />
      )}
      {users.map((user) => (
        <div
          key={user.uid}
          id={`user-${user.uid}`}
          className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video"
        />
      ))}
    </div>
  );

  if (!agoraAppID) {
    return (
      <div className="p-6 text-red-500 font-semibold">
        Error: Agora App ID not found
      </div>
    );
  }

  if (isInCall) {
    return (
      <div className="relative min-h-screen bg-gray-900">
        <VideoGrid />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              isAudioOn ? "bg-gray-700" : "bg-red-500"
            }`}
          >
            {isAudioOn ? (
              <Mic className="text-white" />
            ) : (
              <MicOff className="text-white" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${
              isVideoOn ? "bg-gray-700" : "bg-red-500"
            }`}
          >
            {isVideoOn ? (
              <Video className="text-white" />
            ) : (
              <VideoOff className="text-white" />
            )}
          </button>

          <button
            onClick={startScreenShare}
            className={`p-4 rounded-full ${
              screenTrack ? "bg-green-500" : "bg-gray-700"
            }`}
          >
            <Share2 className="text-white" />
          </button>

          <button
            onClick={leaveChannel}
            className="p-4 rounded-full bg-red-500"
          >
            <X className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Join Video Call
        </h1>
        <div className="space-y-6">
          <input
            type="text"
            placeholder="Enter channel name"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            onClick={() => setIsInCall(true)}
            disabled={!channelName}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Join Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
