# Create a full Serverless Microservices stack rapidly
Create a heterogenous, serverless microservice stack to handle orders with Chuck Norris jokes thrown in

# What is it?
* Place an order with a chatbot running on an Azure Bot Service powered by functions and running on a serverless container
*	Handle the order via a number of heterogenous serverless components
*	Mail the user with order confirmations 
* PowerBI dashboards to showcase message flows

# What does it showcase?

This solution aims to show how a variety of serverless components can be rapidly brought together to build an end to end solution to serve orders using a few microservice patterns as showcased [here](http://azureinteractives.azurewebsites.net/CloudDesignPatterns/default.html) 

# The end to end scenario

This solution will allow a customer to place an order for a coffee via chat bot. The order will be processed and the user will receive a notification. A customer is directed to a atechnology stack which provides an SLA related to their subscription. For example, premium customers may be routed to a fixed Azure Kubernetes service to fulfil their orders while PayAsYouGo customers are routed to a serverless stack with rate limiting applied.

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

An Azure Bot service instance will run inside a container on Azure Container Instances to take orders from customers. It will then route the request to API Management which will at runtime determine the subscription level of the customer and route them to the relevant technology stack, e.g. PayAsYouGo customers get routed to a serverless stack with rate limiting, Premium customers get routed to a managed Kubernetes stack. This repo will initially start with the PayAsYouGo serverless stack, the [AKS](https://azure.microsoft.com/en-us/services/container-service/) cluster will be added soon. 

An swagger enabled GO API running on Azure Container Services as part of a Container Group will handle the order and write it CosmosDb and place it on a partitioned event hub. A nodejs sidecar container running in this Container Group will listen to a specificed partition on the event hub and route the reques to another swagger enabled Go container which will fulfill the order. 

Once an order is fullfilled an event will be triggered to invoke an Azure function which will notify the customer that their order has been processed via SendGrid. 

Below is the sample flow for the Serverless component of this solution:


# Tools required

For this Lab you will require:

* Install the Azure CLI 2.0, get it here - https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
* Install Docker, get it here - https://docs.docker.com/engine/installation/
* Install Kubectl, get it here - https://kubernetes.io/docs/tasks/tools/install-kubectl/
* Install Postman, get it here - https://www.getpostman.com - this is optional but useful
* Provision a free SendGrid account, sign up here - https://app.sendgrid.com/signup?id=71713987-9f01-4dea-b3d4-8d0bcd9d53ed

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
![alt text](https://github.com/shanepeckham/ServerlessMicroservices/blob/master/images/topology.png)

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

In the command terminal, login using the AZ CLI and we will start off by creating a new resource group for our Container instance. At the time of writing this functionality is still in preview and is thus not available in all regions (it is currently available in westeurope, eastus, westus), hence why we will create a new resource group just in case.

Enter the following:

```
az group create --name <yourACIresourcegroup> --location <westeurope, eastus, westus>
```

### Associate the environment variables with Azure Container Instance

We will now deploy our container instance via an ARM template, which is [here](https://github.com/shanepeckham/ContainersOnAzure_MiniLab/blob/master/azuredeploy.json) but before we do, we need to edit this document to ensure we set our environment variables.


In the document, the following section needs to be amended, adding your environment keys like you did before:

```

"properties": {
                "containers": [
                    {
                        "name": "[variables('container1name')]",
                        "properties": {
                            "image": "[variables('container1image')]",
                            "environmentVariables": [
                                {
                                    "name": "DATABASE",
                                    "value": "<your cosmodb username from step 1>"
                                },
                                {
                                    "name": "PASSWORD",
                                    "value": "<your cosmodb password from step 1>"
                                },
                                {
                                    "name": "INSIGHTSKEY",
                                    "value": "<you app insights key from step 2>"
                                },
                                {
                                    "name": "SOURCE",
                                    "value": "ACI"
                                }
                            ],

```


Once this document is saved, we can create the deployment via the az CLI. Enter the following:

```
az group deployment create --name <yourACIname> --resource-group <yourACIresourcegroup> --template-file /<path to your file>/azuredeploy.json
```

It is also possible to create the container instance via the Azure CLI directly.

```
az container create -n go-order-sb -g <yourACIresourcegroup> -e DATABASE=<your cosmodb username from step 1> PASSWORD=<your cosmodb password from step 1> INSIGHTSKEY=<your app insights key from step 2> SOURCE="ACI"--image <yourcontainerregistryinstance>.azurecr.io/go_order_sb:latest --registry-password <your acr admin password>
```

You can check the status of the deployment by issuing the container list command:

```
az container show -n go-order-sb -g <yourACIresourcegroup> -o table
```

Once the container has moved to "Succeeded" state you will see your external IP address under the "IP:ports" column, copy this value and navigate to http://yourACIExternalIP:8080/swagger and test your API like before.


