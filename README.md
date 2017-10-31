# Create an end to end (mostly) serverless microservices stack rapidly to handle orders
Create a heterogenous, serverless microservice stack to handle orders with Chuck Norris jokes thrown in

![Output sample](https://github.com/shanepeckham/ServerlessMicroservices/raw/master/ServerlessMini.gif)

# What is it?
* Place an order with a chatbot running on an Azure Bot Service powered by functions and running on a serverless container
*	Handle the order via a number of heterogenous serverless components
*	Mail the user with order confirmations 
* PowerBI dashboards to showcase deep analytics of the API Management gateway

# What does it showcase?

This solution aims to show how a variety of serverless components can be rapidly brought together to build an end to end solution to serve orders using a few microservice patterns as showcased [here](http://azureinteractives.azurewebsites.net/CloudDesignPatterns/default.html) 

# The end to end scenario

An Azure Bot service instance will run inside a container on Azure Container Instances to take orders from customers. It will then route the request to API Management which will at runtime determine the subscription level of the customer and route them to the relevant technology stack, e.g. PayAsYouGo customers get routed to a serverless stack with rate limiting, Premium customers get routed to a managed Kubernetes stack. This repo will initially start with the PayAsYouGo serverless stack, the [AKS](https://azure.microsoft.com/en-us/services/container-service/) cluster will be added soon. 

A swagger enabled GO API running on Azure Container Services as part of a Container Group will handle the order and write it CosmosDb and place it on a partitioned event hub. A nodejs sidecar container running in this Container Group will listen to a specificed partition on the event hub and route the reques to another swagger enabled Go container which will fulfill the order. 

Once an order is fullfilled an event will be triggered to invoke an Azure function which will notify the customer that their order has been processed via SendGrid. 

# Technology used

The following technology components are used in this solution:

*	Azure Bot Service running on Azure Container Instances and powered by Azure Functions
*	Azure API Management to apply a Gatekeeper, strangler, circuit breaker and throttling pattern
* A Golang container with a node.js sidecar running as a container group within Azure Container Services
* Azure event hubs to handle asynchronous messaging and to decouple the micro services
* Azure CosmosDB to provide a low-latency, globally distributed serverless database which may be used as an event store
* Azure functions to provide event driven compute to do transformations and send email notifications via SendGrid
* PowerBI to monitor all incoming requests to API Management and provide rich dashboards

# Solution Flow

Below is the sample flow for the Serverless component of this solution:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/topology.png)

# Tools required

For this Lab you will require:

* Install the Azure CLI 2.0, get it here - https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
* Install git command line tools, get it here - https://git-scm.com/downloads
* Install Postman, get it here - https://www.getpostman.com - this is optional but useful
* Provision a free SendGrid account, sign up here - https://app.sendgrid.com/signup?id=71713987-9f01-4dea-b3d4-8d0bcd9d53ed
* Get a free PowerBI account, sign up here - https://powerbi.microsoft.com/en-us/get-started/

When using the Azure CLI, after logging in, if you have more than one subscripton you may need to set the default subscription you wish to perform actions against. To do this use the following command:

```
az account set --subscription "<your requried subscription guid>"
```

## 1. Provisioning a Cosmos DB instance

Let's start by creating a Cosmos DB instance in the portal, this is a quick process. Navigate to the Azure portal and create a new Azure Cosmos DB instance, enter the following parameters:

* ID: <yourdbinstance>
* API: Select MongoDB as the API as our container API will use this driver
* ResourceGroup: <yourresourcegroup>
* Location: <yourlocation>

See below:
![alt text](https://github.com/shanepeckham/ContainersOnAzure_MiniLab/blob/master/images/CosmosDB.png)

Once the DB is provisioned, we need to get the Database Username and Password, these may be found in the Settings --> Connection Strings section of your DB. We will need these to run our container, so copy them for convenient access. See below:

![alt text](https://github.com/shanepeckham/ContainersOnAzure_MiniLab/blob/master/images/DBKeys.png)

## 2. Provisioning a API Management instance

Navigate to the Azure portal and create a new Azure API Management instance, enter the following parameters:

* Name: <yourinstancename>
* ResourceGroup: <yourresourcegroup>
* Location: <yourlocation>
* Organisation name: <yourorgname>
* Administrator email: <youradminemail>

See below:
![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apim.png)

This will take a few minutes.

## 3. Provisioning an eventhub instance

Navigate to the Azure portal and create a new Azure event hub instance, enter the following parameters:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/eh1.png)

* Name: <yourinstancename>
* ResourceGroup: <yourresourcegroup>
* Location: <yourlocation>

This will take a few minutes. Once this has completed add an event hub, give it a partition count of 2 (the default), see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/eh2.png)

## 4. Deploy the containers to Azure Container Instance

Now we will deploy our container to [Azure Container Instances](https://azure.microsoft.com/en-us/services/container-instances/). 

We will first deploy the fulfillorder container which provide us with a public endpoint which we will use to route requests to from the nodejs side car container. Note, this fulfillorder endpoint will be publically available, we will look to secure it in the future.

In the command terminal, login using the AZ CLI and we will start off by creating a new resource group for our Container instance. At the time of writing this functionality is still in preview and is thus not available in all regions (it is currently available in westeurope, eastus, westus), hence why we will create a new resource group just in case.

Enter the following:

```
az group create --name <yourACIresourcegroup> --location <westeurope, eastus, westus>
```

### Associate the environment variables with the fulfillorder container

We will now deploy our container instance via a declarative 'infrastructure as code' ARM template, which is [here](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/fulfillorder.json) but before we do, we need to edit this document to ensure we set our environment variables.


In the document, the following section needs to be amended, adding your environment keys:

```

"name": "[variables('container1name')]",
                        "properties": {
                            "image": "[variables('container1image')]",
                            "environmentVariables": [
                                {
                                    "name": "DATABASE",
                                    "value": ""
                                },
                                {
                                    "name": "PASSWORD",
                                    "value": ""
                                },
                                {
                                    "name": "INSIGHTSKEY",
                                    "value": ""
                                },
                                {
                                    "name": "SOURCE",
                                    "value": "ACI"
                                },
                                {
                                    "name": "EVENTURL",
                                    "value": "https://[youreventhubname].servicebus.windows.net/[youreventhub]"
                                },
                                {
                                    "name": "EVENTPOLICYNAME",
                                    "value": "[your policy key]"
                                },
                                {
                                    "name": "EVENTPOLICYKEY",
                                    "value": "[the access key from your policy]"
                                }
                            ],
```




Once this document is saved, we can create the deployment via the az CLI. Enter the following:

```
az group deployment create --name <yourACIname> --resource-group <yourACIresourcegroup> --template-file /<path to your file>/fulfillorder.json
```

It is also possible to create the container instance via the Azure CLI directly, but it is best practice to deploy declaratively for automation and transparency.

You can check the status of the deployment by issuing the container list command:

```
az container show -n go-order-sb -g <yourACIresourcegroup> -o table
```

Once the container has moved to "Succeeded" state you will see your external IP address under the "IP:ports" column, copy this value, we will refer this this ip address as [fulfillorderIP]

We will now deploy a Container Group for the captureorder and eventlistener sidecar containers on Azure Container Instances via a declarative 'infrastructure as code' ARM template, which is [here](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/ordergroup.json) but before we do, we need to edit this document to ensure we set our environment variables.


In the json, the following section for the captureorder container needs to be amended, adding your environment keys like you did before:

```

"name": "[variables('container1name')]",
                        "properties": {
                            "image": "[variables('container1image')]",
                            "environmentVariables": [
                                {
                                    "name": "DATABASE",
                                    "value": ""
                                },
                                {
                                    "name": "PASSWORD",
                                    "value": ""
                                },
                                {
                                    "name": "INSIGHTSKEY",
                                    "value": ""
                                },
                                {
                                    "name": "SOURCE",
                                    "value": "ACI"
                                },
                                {
                                    "name": "EVENTURL",
                                    "value": "https://[youreventhubname].servicebus.windows.net/[youreventhub]"
                                },
                                {
                                    "name": "EVENTPOLICYNAME",
                                    "value": "[your policy key]"
                                },
                                {
                                    "name": "EVENTPOLICYKEY",
                                    "value": "[the access key from your policy]"
                                }
                                {
                                    "name": "PARTITIONKEY",
                                    "value": "[select a partition key]"
                                }
                            ],
```

And for the eventlistener sidecar container, populate the following variables: 

```
"name": "[variables('container2name')]",
                        "properties": {
                            "image": "[variables('container2image')]",
                            "environmentVariables": [
                                {
                                    "name": "EVENTHUBCONNSTRING",
                                    "value": "Endpoint=sb://[youreventhub].servicebus.windows.net/;SharedAccessKeyName=[accesspolicyname];SharedAccessKey=[policykey]""
                                },
                                {
                                    "name": "EVENTHUBPATH",
                                    "value": "[eventhub]"
                                },
                                {
                                    "name": "INSIGHTSKEY",
                                    "value": ""
                                },
                                {
                                    "name": "SOURCE",
                                    "value": "ACI"
                                },
                                {
                                    "name": "PROCESSENDPOINT",
                                    "value": "[fulfillorderIP]:8080/v1/order/"
                                },
                                {
                                    "name": "PARTITIONKEY",
                                    "value": "[select a partition key]"
                                }
                            ],

```


Once this document is saved, we can create the deployment via the az CLI. Enter the following:

```
az group deployment create --name <yourACIname> --resource-group <yourACIresourcegroup> --template-file /<path to your file>/ordergroup.json
```

Once the container group has moved to "Succeeded" state you will see your external IP address under the "IP:ports" column, copy this value and navigate to http://yourACIExternalIP:8080/swagger and test your API. You should be able to place an order with the captureorder swagger harness, which will create the order in CosmosDb with a status of 'Open' and place it on the event hub partition. The eventlistener container will then pick up the message and route it to the fulfillorder container which will set the status to 'Processed'. 

## 5. Register the captureorder endpoint with API Management

In the API Management publisher portal, create two new products called "PayAsYouGo" and "Premium", note the syntax should be exactly the same as listed here.

Now add a new API with the following settings:

Web API Name: OrdersGateway
Web Service URL: http://[captureorderIP]:8080/v1/ ** This is your ip address from the orderGroup Azure Container Instance deployed before.
Web API URL suffix: order
Web API URL scheme: HTTPS

Add an operation to the API called PlaceOrder, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apioperation.png)

See below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/ordergateway.png)

Make a note of the value in "This is what the Web API URL is going to look like:", we will refer to it as [your APIM Endpoint] from now on.

Now click on the Products tab and select 'Add API To Products' and associate the PayAsYouGo and Premium products to the API, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apiproducts.png)

Now click on Policies and select the OrdersGateway API with method PlaceOrder, we will add a policy to dynamically rate limit based on the user's subscription. We will and an AKS stack later, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apipolicy.png)

Add the following policy:

```
<policies>
	<inbound>
		<base />
		<choose>
			<when condition="@(context.Product.Name.Equals("PayAsYouGo"))">
				<rate-limit-by-key calls="100" renewal-period="60" increment-condition="@(context.Response.StatusCode == 200)" counter-key="@(context.Request.IpAddress)" />
			</when>
			<when condition="@(context.Product.Name.Equals("Premium"))">
				<rate-limit-by-key calls="1000" renewal-period="60" increment-condition="@(context.Response.StatusCode == 200)" counter-key="@(context.Request.IpAddress)" />
			</when>
		</choose>
		<send-request mode="copy" response-variable-name="response" timeout="10" ignore-error="true">
			<set-method>POST</set-method>
			<set-header name="Content-Type" exists-action="override">
				<value>application/json</value>
			</set-header>
			<set-body>@{   
                            var source = context.Product.Name;
                            JObject inBody = context.Request.Body.As<JObject>();
                            var postBody = new JObject(
                            new JProperty("EmailAddress", inBody["EmailAddress"]),
                            new JProperty("PreferredLanguage", inBody["PreferredLanguage"]),
                            new JProperty("Product", inBody["Product"]),
                            new JProperty("Status", inBody["Status"]),
                            new JProperty("Source", source)
                            ).ToString();
                            
                        return postBody;

                        }</set-body>
		</send-request>
	</inbound>
	<backend>
		<base />
	</backend>
	<outbound>
		<base />
	</outbound>
	<on-error>
		<base />
	</on-error>
</policies>

```

This section will determine the subscription level of the requestor and apply a rate limit of 100 calls per 60 seconds for PayAsYouGo and 1000 calls per 60 seconds for Premium:
```
<choose>
			<when condition="@(context.Product.Name.Equals("PayAsYouGo"))">
				<rate-limit-by-key calls="100" renewal-period="60" increment-condition="@(context.Response.StatusCode == 200)" counter-key="@(context.Request.IpAddress)" />
			</when>
			<when condition="@(context.Product.Name.Equals("Premium"))">
				<rate-limit-by-key calls="1000" renewal-period="60" increment-condition="@(context.Response.StatusCode == 200)" counter-key="@(context.Request.IpAddress)" />
			</when>
		</choose>
```

This section will intercept the incoming json, amend it and reforward it to our backend.

```
	<send-request mode="copy" response-variable-name="response" timeout="10" ignore-error="true">
			<set-method>POST</set-method>
			<set-header name="Content-Type" exists-action="override">
				<value>application/json</value>
			</set-header>
			<set-body>@{   
                            var source = context.Product.Name;
                            JObject inBody = context.Request.Body.As<JObject>();
                            var postBody = new JObject(
                            new JProperty("EmailAddress", inBody["EmailAddress"]),
                            new JProperty("PreferredLanguage", inBody["PreferredLanguage"]),
                            new JProperty("Product", inBody["Product"]),
                            new JProperty("Status", inBody["Status"]),
                            new JProperty("Source", source)
                            ).ToString();
                            
                        return postBody;

                        }</set-body>
		</send-request>

```
You should now be able to test your API Management endpoint and see the request flow through the Azure Container Instances with the status of the order changing in CosmosDb.

To do this select the Developer Potal --> API --> OrdersGateway --> Place Order --> Try it.

Make a note of the subscription keys for the PayAsYouGo and Premium subscriptions as we will need these later and will refer to them as [the PayAsYouGo subscription key] and [the Premium subscription key] respectively.

## 6. Deploy the API Management analytics solution

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apimdashboard.png)

Navigate to the [API Management Analytics solution](https://appsource.microsoft.com/en-us/product/web-apps/microsoft-powerbi.pbisolntemplate_apimanagement?tab=Overview) and follow the installation instructions.

## 7. Create an Azure Bot Service app and deploy some code to it

Create a Bot Service app within Azure.

![alt text](https://github.com/shanepeckham/CADScenario_Personalisation/blob/master/images/botsetup1.png)

Click 'Create Microsoft App Id and Password'. This will open up a new window where you will register your Bot App Id. Select 'Generate an app password to continue', see below:

![alt text](https://github.com/shanepeckham/CADScenario_Personalisation/blob/master/images/botsetup2.png)

This will open up a popup with your password in, copy this value for immediate reuse. Note, it only appears this once. Click 'Finish and go back to Bot Framework'. Paste your password in the entry box.

Now select 'NodeJS' in the Choose a Language section and select 'Form' in the Choose a Template section (at the time of writing this a necessary step even though our code will overwrite these settings) and click 'Create Bot', see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botlang.png)

This will take roughly 2-3 minutes, once complete you will be navigated to the code view of the Bot. Click on the Settings tab and select the Continuous Deployment section, select the "I completed step 2 and can proceed to step 3" checkbox, then click Configure in step 3, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botcheck.png)

Select Setup and choose Local Git Repository as the source for the Deployment Option.

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botlocalgit.png)

Now open a command window and find a suitable location in your directory structure and type:

```
git clone https://github.com/shanepeckham/ServerlessMicroservices.git
cd fdcoffeebot
```
You should see the files listed below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botfiles.png)

Now navigate back to the bot and select Open in the Advanced Settings section, copy the value in Git Clone URL, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/gitcloneurl.png)

Back in terminal window type the following:

```
git init
git remote add Azure [paste your git clone url]
git add . 
git commit -m "Bot release"
git push Azure master
```

This will deploy the bot and when complete you should see something similar to the following:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botdeployed.png)

Once the status in the continuous deployment is set to active, your bot should be good to go, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botrelease.png)


This will take a minute or two to deploy. If you navigate back to the code view you should now see the following code within the first 15 or so lines:

```
var orderURL = process.env.orderURL;
var feedback;
var contents;
var joke;
var SLAKey;
```

The last step now before we can test the bot is to navigate back to Settings and open Application Settings, here we need to create three values, namely:

orderURL: [your APIM Endpoint]
PayAsYouGo: [the PayAsYouGo subscription key]
Premium: [the Premium subscription key]

Click Save to commit the changes, you can now test the bot.

Look inside your CosmosDB, if you see an order with the status Processed then all parts are working.

In the Azure portal, navigate back to your Cosmos DB instance and go to the section Data Explorer (note, at the time of writing this is in preview so is subject to change). We can now query for the order we placed. A collection called 'orders' will have been created within your database, you can then apply a filter for the id we created, namely:

See below:

![alt text](https://github.com/shanepeckham/ContainersOnAzure_MiniLab/blob/master/images/CosmosQuery.png)

## 8. Embed the Bot Service app inside a container and deploy it to an Azure Container Instance

We will deploy a container to house our Bot so that it can be accessed on the web, using the same method as we did before, we only need to populate one environment variable in the container, namely the Bot's Web Chat iframe and secret key. In the Bot navigate to Channels, and select Edit on the Web Chat channel, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/botkey.png)

Copy the only this part of value in the field Embed Code, like this:

```
https://webchat.botframework.com/embed/testbotdeleteme?s=YOUR_SECRET_HERE
```

Now click Show on the primary secret key and copy it, replace the value above [YOUR_SECRET_HERE] with the primary key so that it looks like this:

```
https://webchat.botframework.com/embed/testbotdeleteme?s=[You primary secrect key]

```

We will now deploy our container instance via a declarative 'infrastructure as code' ARM template, which is [here](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/botwebsite.json) but before we do, we need to edit this document to ensure we set our environment variable for the Bot Key.


In the document, the following section needs to be amended, adding the environment key like you did before:

```
{
                        "name": "[variables('container1name')]",
                        "properties": {
                            "image": "[variables('container1image')]",
                            "environmentVariables": [
                                {
                                    "name": "BOTURL",
                                    "value": "https://webchat.botframework.com/embed/testbotdeleteme?s=[You primary secrect key]"
                                }
                            ],

```

Once this document is saved, we can create the deployment via the az CLI. Enter the following:

```
az group deployment create --name <yourACIname> --resource-group <yourACIresourcegroup> --template-file /<path to your file>/botwebsite.json
```

Once deployed, if you navigate to [yourACIName IP address]:8080 you should see your website where you can interact with your bot and place an order and get a Chuck Norris joke courtesy of The Internet Chuck Norris Dabatase,  see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/bot.png)


## 9. Sign up for a free SendGrid account so that you can send emails for free

Provision a free SendGrid account, sign up here - https://app.sendgrid.com/signup?id=71713987-9f01-4dea-b3d4-8d0bcd9d53ed

Store your SendGrid API key which will now refer to as [SendGridAPIKey]

## 10. Create an Azure Function to notify users that their order has been processed

We will now create an event driven function to notify the user via email when their order has been processed. Create a new Azure function and select Language: Javascript, Scenario: Data Processing and select Template CosmosDb trigger, see below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/functemp.png)

Once created. navigate to Platform Features --> Application Settings where we will add the [SendGridAPIKey] as a configuration setting independant of the Function code.

Add the following entryand Save:

SendGridKey: [SendGridAPIKey]

Now in the Integrate section of your Function, bind the function to your ComsmosDb and SendGrid instances. Firstly in the Triggers section, add a new input with the folloing settings in Azure Cosmos TB Trigger section:

* Document collection parameter name: inputDocuments
* Database name: (Your CosmosDb name]
* Collection name for leases: processed
* CosmosDB Account connection: Here you can select your database instance from the dropdown
* Collection name: orders
* Create lease collection if it does not exist: true

See below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/dbinputs.png)

Now in the Outputs and an out for SendGrid with the following values:

* Message parameter name: $return
* Use function return value: True
* To Address: Can be blank as we will set it in code dynamically
* Message Subject: SendGrid output bindings
* SendGrid API Key App Setting: Select the application setting SendGridKey from the dropdown
* From Address: We will set this dynamically in code
* Message Text: We will set this in code

See below:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/dboutputs.png)

Once this is down you can paste the folllowing code into your Function:

```

var to;
var message;

module.exports = function (context, myQueueItem) {
    context.log('Order: ' + myQueueItem[0].$v.id.$v + ' - Status:' + myQueueItem[0].$v.status.$v);
    context.bindings.message = {};

    if (myQueueItem[0].$v.emailaddress.$v != "" || myQueueItem[0].$v.emailaddress.$v != "string" && myQueueItem[0].$v.status.$v == 'Processed' ) {
        to = myQueueItem[0].$v.emailaddress.$v;
        var input = "Your " + myQueueItem[0].$v.product.$v + " with order id " + myQueueItem[0].$v.id.$v + " has been processed";
        var message = {
            "personalizations": [ { "to": [ { "email": to } ] } ],
            from: { email: "fdcoffeebot@coffeeandchucknorrisjokes.com" },        
            subject: "Your " + myQueueItem[0].$v.product.$v + " has been processed",
            content: [{
                type: 'text/plain',
                value: input
            }]
    };
    }

    context.done(null, message);
    return message;
};

```

The end to end solution is now set up and shold be able to test it.
