// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';
var EventHubClient = require('azure-event-hubs').Client;
var Promise = require('bluebird');
var util = require("util");
let appInsights = require('applicationinsights');
var request = require('request');

// Start
var source = process.env.SOURCE;
var partitionKey = process.env.PARTITIONKEY;
var connectionString = process.env.EVENTHUBCONNSTRING;
var eventHubPath = process.env.EVENTHUBPATH;
var processendpoint = process.env.PROCESSENDPOINT;
var insightsKey = process.env.INSIGHTSKEY;

if (insightsKey != "") {
  appInsights.setup(insightsKey).start();
}

// The Event Hubs SDK can also be used with an Azure IoT Hub connection string.
// In that case, the eventHubPath variable is not used and can be left undefined.

var body = "";

var printError = function (err) {
  console.error(err.message);
};

console.log('Listening on partitiion ' + partitionKey);

var printEvent = function (ehEvent) {
  console.log('Event Received: ');
  var jj = JSON.stringify(ehEvent.body);
  let bufferOriginal = Buffer.from(JSON.parse(jj).data);
  console.log(bufferOriginal.toString('utf8'));
  var jstring = bufferOriginal.toString('utf8');

  var orderId = jstring.substring(10, 34);

  // Set the headers
  var headers = {
    'Content-Type': 'application/json'
  };

  // Configure the request
  var options = {
    url: processendpoint,
    method: 'POST',
    headers: headers,
    json: { 'ID': orderId }
  };

  // Start the request
  try {
    request(options, function () {
    });
  }
  catch (e) {
    session.send('error!: ' + e.message);
  }

  try {

    if (insightsKey != "") {
      let appclient = appInsights.defaultClient;
      appclient.trackEvent("Event Order " + source + ": " + orderId);
    }
  }

  catch (e) {
    console.error("AppInsights " + e.message);
  }

};

var client = EventHubClient.fromConnectionString(connectionString, eventHubPath);
var receiveAfterTime = Date.now() - 5000;


client.open()
return client.createReceiver('$Default', partitionKey, { 'startAfterTime': receiveAfterTime }).then(function (receiver) {
  receiver.on('errorReceived', printError);
  receiver.on('message', printEvent);
}).catch(printError);
