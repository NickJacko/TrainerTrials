from TikTokLive import TikTokLiveClient
from TikTokLive.events import LikeEvent, ConnectEvent

client = TikTokLiveClient(unique_id="@trainertrial")

@client.on(ConnectEvent)
async def on_connect(event: ConnectEvent):
    print(f"✅ Verbunden mit @{event.unique_id}")

@client.on(LikeEvent)
async def on_like(event: LikeEvent):
    print(f"❤️ @{event.user.nickname} liked! (gesamt: {event.total_likes})")

if __name__ == '__main__':
    client.run()
