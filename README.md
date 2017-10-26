# ServerlessMicroservices
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

# Preparing for this lab

For this Lab you will require:

* Install the Azure CLI 2.0, get it here - https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
* Install Docker, get it here - https://docs.docker.com/engine/installation/
* Install Kubectl, get it here - https://kubernetes.io/docs/tasks/tools/install-kubectl/
* Install Postman, get it here - https://www.getpostman.com - this is optional but useful

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
