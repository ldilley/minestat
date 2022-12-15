MineStat
========

MineStat is a Minecraft server status checker.

### JavaScript example
```javascript
const MineStat = require("minestat");

// Example with address, port, and timeout:
//var ms = new MineStat("minecraft.frag.land", 25565, 5, function(result)

var ms = new MineStat("minecraft.frag.land", function(result)
{
  console.log("Minecraft server status of " + ms.address + " on port " + ms.port + ":");
  if(ms.online)
  {
    console.log("Server is online running version " + ms.version + " with " + ms.current_players + " out of " + ms.max_players + " players.");
    console.log("Message of the day: " + ms.motd);
    console.log("Latency: " + ms.latency + "ms");
  }
  else
  {
    console.log("Server is offline!");
  }
});
```
