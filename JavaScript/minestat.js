/*
 * minestat.js - A Minecraft server status checker
 * Copyright (C) 2016, 2022 Lloyd Dilley
 * http://www.dilley.me/
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

const VERSION = "2.0.0";        // MineStat version
const NUM_FIELDS = 6;           // number of values expected from server
const NUM_FIELDS_BETA = 3;      // number of values expected from a 1.8b/1.3 server
const DEFAULT_TCP_PORT = 25565; // default TCP port
const DEFAULT_TIMEOUT = 5;      // default TCP timeout in seconds

const StatusCode =
{
	SUCCESS: "Sucess",  // connection was successful and the response data was parsed without problems
	CONNFAIL: "Fail",   // connection failed due to an unknown hostname or incorrect port number
	TIMEOUT: "Timeout", // connection timed out -- either the server is overloaded or it dropped our packets
	UNKNOWN: "Unknown"  // connection was successful, but the response data could not be properly parsed
}

const RequestType =
{
  NONE: -1,    // try everything
  BETA: 0,     // server versions 1.8b to 1.3
  LEGACY: 1,   // server versions 1.4 to 1.5
  EXTENDED: 2, // server version 1.6
  JSON: 3,     // server versions 1.7 to latest
  BEDROCK: 4   // Bedrock/Pocket Edition
}

class MineStat
{
  constructor(address, port = DEFAULT_TCP_PORT, timeout = DEFAULT_TIMEOUT, request_type = RequestType.NONE, callback)
  {
    // Check for callback function based on positional arguments of constructor
    if(typeof(port) === typeof(Function()))
    {
      this.callback = port;
      this.port = DEFAULT_TCP_PORT;
      this.timeout = DEFAULT_TIMEOUT;
      this.request_type = RequestType.NONE;
    }
    else if(typeof(timeout) === typeof(Function()))
    {
      this.callback = timeout;
      this.port = port;
      this.timeout = DEFAULT_TIMEOUT;
      this.request_type = RequestType.NONE;
    }
    else if(typeof(request_type) === typeof(Function()))
    {
      this.callback = request_type;
      this.port = port;
      this.timeout = timeout;
      this.request_type = RequestType.NONE;
    }
    else
    {
      this.port = port;
      this.timeout = timeout;
      this.request_type = RequestType.NONE;
      this.callback = callback;
    }
    this.address = address;           // address of server
    //this.port = port;                 // TCP port of server
    //this.timeout = timeout;           // TCP timeout
    //this.request_type = request_type; // protocol to use for querying server
    this.online = false;              // online or offline?
    this.version = null;              // server version
    this.motd = null;                 // message of the day
    this.current_players = -1;        // current number of players online
    this.max_players = -1;            // maximum player capacity
    this.latency = -1;                // ping time to server in milliseconds
    this.connection_status = -1;      // status of connection ("Success", "Fail", "Timeout", or "Unknown")

    if(this.request_type == RequestType.BETA)
      this.beta_request();
    else if(this.request_type == RequestType.LEGACY)
      this.legacy_request();
    else if(this.request_type == RequestType.EXTENDED)
      this.extended_request();
    else if(this.request_type == RequestType.JSON)
      this.json_request();
    else if(this.request_type == RequestType.BEDROCK)
      this.bedrock_request();
    else
    {
      this.legacy_request();
      /*if(this.connection_status != StatusCode.SUCCESS && this.connection_status != StatusCode.CONNFAIL)
        this.beta_request();
      if(this.connection_status != StatusCode.CONNFAIL)
        this.extended_request();
      if(this.connection_status != StatusCode.CONNFAIL)
        this.json_request();
      if(!this.online)
        this.bedrock_request();*/
    }
  }

  beta_request()
  {
    const net = require("net");
    var start_time = new Date();
    const client = net.connect(this.port, this.address);
    this.latency = Math.round(new Date() - start_time);
    var buff = Buffer.from([ 0xFE ]);
    client.write(buff);
    client.setTimeout(this.timeout * 1000);

    client.on("data", (data) =>
    {
      if(data != null && data != "")
      {
        if(data[0] == 255) // kick packet (0xFF)
        {
          /*
           * toString() converts to UTF-8 by default which converts the section character, '\xA7',
           * to the replacement character, '\uFFFD'. Use ISO-8859-1 instead.
          */
          var server_info = data.toString("latin1", 4).split("\xA7");
          if(server_info != null && server_info.length >= NUM_FIELDS_BETA)
          {
            this.online = true;
            this.version = ">=1.8b/1.3";
            this.motd = server_info[0];
            this.current_players = server_info[1];
            this.max_players = server_info[2];
            this.connection_status = StatusCode.SUCCESS;
          }
          else
          {
            this.online = false;
            this.connection_status = StatusCode.UNKNOWN;
          }
        }
        else
        {
          this.online = false;
          this.connection_status = StatusCode.UNKNOWN;
        }
      }
      client.end();
      this.callback();
    });

    client.on("timeout", () =>
    {
      this.connection_status = StatusCode.TIMEOUT;
      client.end();
      this.callback();
      //process.exit();
    });

    client.on("end", () =>
    {
    });

    client.on("error", (err) =>
    {
      this.connection_status = StatusCode.CONNFAIL;
      this.callback();
    });
  }

  legacy_request()
  {
    const net = require("net");
    var start_time = new Date();
    const client = net.connect(this.port, this.address);
    this.latency = Math.round(new Date() - start_time);
    var buff = Buffer.from([ 0xFE, 0x01 ]);
    client.write(buff);
    client.setTimeout(this.timeout * 1000);

    client.on("data", (data) =>
    {
      if(data != null && data != "")
      {
        var server_info = data.toString().split("\x00\x00\x00");
        if(server_info != null && server_info.length >= NUM_FIELDS)
        {
          this.online = true;
          this.version = server_info[2].replace(/\u0000/g,"");
          this.motd = server_info[3].replace(/\u0000/g,"");
          this.current_players = server_info[4].replace(/\u0000/g,"");
          this.max_players = server_info[5].replace(/\u0000/g,"");
          this.connection_status = StatusCode.SUCCESS;
        }
        else
        {
          this.online = false;
          this.connection_status = StatusCode.UNKNOWN;
        }
      }
      client.end();
      if(this.request_type != RequestType.NONE)
        this.callback();
      else if(this.connection_status == StatusCode.SUCCESS)
        //this.extended_request();
        this.callback();
      else
        this.beta_request();
    });

    client.on("timeout", () =>
    {
      this.connection_status = StatusCode.TIMEOUT;
      client.end();
      this.callback();
      //process.exit();
    });

    client.on("end", () =>
    {
    });

    client.on("error", (err) =>
    {
      this.connection_status = StatusCode.CONNFAIL;
      this.callback();
    });
  }

  // ToDo: Implement me.
  extended_request()
  {

  }

  // ToDo: Implement me.
  json_request()
  {

  }

  // ToDo: Implement me.
  bedrock_request()
  {

  }
}

module.exports = MineStat
