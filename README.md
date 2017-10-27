# Create an end to end serverless microservices stack rapidly to handle orders
Create a heterogenous, serverless microservice stack to handle orders with Chuck Norris jokes thrown in

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
* Azure event hubs to handle asynchronous messaging and to decouple some the micro services
* Azure CosmosDB to provide a low-latency, globally distributed serverless database which may be used as an event store
* Azure functions to provide event driven compute to do transformations and send email notifications via SendGrid
* PowerBI to monitor all incoming requests to API Management and provide rich dashboards

# Solution Flow

Below is the sample flow for the Serverless component of this solution:

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/topology.png)

# Tools required

For this Lab you will require:

* Install the Azure CLI 2.0, get it here - https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
* Install Docker, get it here - https://docs.docker.com/engine/installation/
* Install Kubectl, get it here - https://kubernetes.io/docs/tasks/tools/install-kubectl/
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


In the document, the following section needs to be amended, adding your environment keys like you did before:

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

## 6. Deploy the API Management analytics solution

![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/apimdashboard.png)

Navigate to the [API Management Analytics solution](https://appsource.microsoft.com/en-us/product/web-apps/microsoft-powerbi.pbisolntemplate_apimanagement?tab=Overview) and follow the installation instructions.
