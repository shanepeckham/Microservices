/*-----------------------------------------------------------------------------
This template demonstrates how to use Waterfalls to collect input from a user using a sequence of steps.
For a complete walkthrough of creating this type of bot see the article at
https://aka.ms/abs-node-waterfall
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var request = require('request');
var fs = require('fs');

var orderURL = process.env.orderURL;
var feedback;
var contents;
var joke;
var SLAKey;

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));

//Let's determine whether we invoke Premium or PayAsYouGo
fs.readFile(__dirname+'//jokes.json', function (err, data) {
    if (err) {
        console.log('ERROR: file.json not found...')
    } else {
        contents = JSON.parse(data)
        console.log(contents);
        var randomnumber=Math.floor(Math.random()*contents.length-1);
        joke = contents[randomnumber].joke;
        var SLA=Math.floor((Math.random()*2)-1);
        if (SLA == 0)
        {
            SLAKey = process.env.PayAsYouGo;
        }
        else
        {
            SLAKey = process.env.Premium;
        }
        
    };
})

bot.dialog('/', [
    function (session) {
        builder.Prompts.text(session, "Hello... What's your email?");
    },
    function (session, results) {
        session.userData.emailAddress = results.response;
        builder.Prompts.choice(session, "Which coffee can I get you?", ["Latte", "Americano", "Cappucino", "Espresso"]);
    },
    function (session, results) {
        session.userData.coffeeType = results.response.entity;
        
        session.send("Got it, you would like a " +  session.userData.coffeeType + ". Check your email - in the meantime here is a cheesy Chuck Norris joke: "+ joke);

        // Set the headers
            var headers = {
              'Content-Type': 'application/json',
              'Ocp-Apim-Trace' : true,
              'Ocp-Apim-Subscription-Key': SLAKey,
              'Source' : "Serverless"
            }
            
            // Configure the request
        var options = {
            url: orderURL, 
            method: 'POST',
            headers: headers,
            json: {'EmailAddress':session.userData.emailAddress, 'Product':session.userData.coffeeType}
        }
        
       // Start the request
       try
       {
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                   feedback = JSON.stringify(body);
                   session.send(util.inspect(feedback, {showHidden: false, depth: null})); 
            }
            else
            {
                session.send(response.statusCode.toString() + error);
            }
        })
       }
       catch(e)
       {
        session.send('error ' + e.message);
       }
    }
    
]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}
