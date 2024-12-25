"use client";
import { useState, useEffect } from "react";
import AgoraRTC, {
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, Share2, X } from "lucide-react";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

interface LocalTracks {
  audioTrack: IMicrophoneAudioTrack | null;
  videoTrack: ICameraVideoTrack | null;
}

const App = () => {
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [channelName, setChannelName] = useState<string>("");
  const [localTracks, setLocalTracks] = useState<LocalTracks>({
    audioTrack: null,
    videoTrack: null,
  });
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(true);
  const [isAudioOn, setIsAudioOn] = useState<boolean>(true);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);

  const agoraAppID = process.env.NEXT_PUBLIC_AGORA_APPID;
  const agoraToken = process.env.NEXT_PUBLIC_AGORA_TOKEN;

  useEffect(() => {
    if (!isInCall) return;

    const initCall = async (): Promise<void> => {
      client.on("user-published", handleUserPublished);
      client.on("user-unpublished", handleUserUnpublished);

      try {
        if (!agoraAppID) throw new Error("Agora App ID is required");
        await client.join(agoraAppID, channelName, agoraToken || null);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();

        await client.publish([audioTrack, videoTrack]);
        setLocalTracks({ audioTrack, videoTrack });

        videoTrack.play("local-user");
      } catch (error) {
        console.error("Call initialization failed:", error);
        setIsInCall(false);
      }
    };

    initCall();

    return () => {
      localTracks.audioTrack?.close();
      localTracks.videoTrack?.close();
      client.removeAllListeners();
      client.leave();
    };
  }, [isInCall, agoraAppID, agoraToken, channelName]);

  const handleUserPublished = async (
    user: IAgoraRTCRemoteUser,
    mediaType: "audio" | "video"
  ): Promise<void> => {
    await client.subscribe(user, mediaType);

    if (mediaType === "video") {
      setRemoteUsers((prev) => {
        if (prev.find((u) => u.uid === user.uid)) return prev;
        return [...prev, user];
      });
      setTimeout(() => user.videoTrack?.play(`user-${user.uid}`), 100);
    }
    if (mediaType === "audio") {
      user.audioTrack?.play();
    }
  };

  const handleUserUnpublished = (user: IAgoraRTCRemoteUser): void => {
    setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
  };

  const toggleVideo = async (): Promise<void> => {
    if (localTracks.videoTrack) {
      await localTracks.videoTrack.setEnabled(!isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = async (): Promise<void> => {
    if (localTracks.audioTrack) {
      await localTracks.audioTrack.setEnabled(!isAudioOn);
      setIsAudioOn(!isAudioOn);
    }
  };

  const toggleScreenShare = async (): Promise<void> => {
    try {
      if (!screenTrack) {
        const track = await AgoraRTC.createScreenVideoTrack();
        await client.publish(track);
        setScreenTrack(track);
        track.play("screen-share");
      } else {
        await client.unpublish(screenTrack);
        screenTrack.close();
        setScreenTrack(null);
      }
    } catch (error) {
      console.error("Screen sharing failed:", error);
    }
  };

  const leaveCall = async (): Promise<void> => {
    localTracks.audioTrack?.close();
    localTracks.videoTrack?.close();
    screenTrack?.close();
    await client.leave();
    setIsInCall(false);
    setRemoteUsers([]);
    setLocalTracks({ audioTrack: null, videoTrack: null });
    setScreenTrack(null);
  };

  if (!agoraAppID) {
    return (
      <div className="p-6 text-red-500">Error: Agora App ID not found</div>
    );
  }

  if (isInCall) {
    return (
      <div className="relative min-h-screen bg-gray-900">
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
          {remoteUsers.map((user) => (
            <div
              key={user.uid}
              id={`user-${user.uid}`}
              className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video"
            />
          ))}
        </div>

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
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
            onClick={toggleScreenShare}
            className={`p-4 rounded-full ${
              screenTrack ? "bg-green-500" : "bg-gray-700"
            }`}
          >
            <Share2 className="text-white" />
          </button>
          <button onClick={leaveCall} className="p-4 rounded-full bg-red-500">
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
