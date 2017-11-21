# Azure Container Services: Kubernetes

You will deploy the following to Kubernetes:

![Services](./services.png)

## Create Resource Group

Please prefix the resource group name with your initials.

```az group create --name=<ResourceGroupName> --location=westeurope```

## Create AKS cluster

```
az provider register -n Microsoft.ContainerService

az aks create --resource-group <ResourceGroupName> --name <ClusterName> --agent-count 3 --generate-ssh-keys

sudo az aks install-cli *** if on linux subsystem for windows
```

### Retrieve Kubernetes credentails and set as current context

```
az aks get-credentials --resource-group <ResourceGroupName> --name <ClusterName>

install helm

```

## Create ACS Cluster

```az acs create --orchestrator-type Kubernetes -g <ResourceGroupName> -n <ClusterName> --service-principal cad58a04-8963-44ff-89c6-9614825<from-whiteboard> --client-secret <from-whiteboard>2c-1e9d-4918-a413-2eca702b5b02```

Or if no SSH credentials exist:

```az acs create --orchestrator-type Kubernetes -g <ResourceGroupName> -n <ClusterName> --service-principal cad58a04-8963-44ff-89c6-9614825<from-whiteboard> --client-secret <from-whiteboard>2c-1e9d-4918-a413-2eca702b5b02 --generate-ssh-keys ```



### Retrieve Kubernetes credentails and set as current context
```az acs kubernetes get-credentials --resource-group=<ResourceGroupName> --name=<ClusterName>```



## Install MongoDB using Helm

More info: https://helm.sh/

```helm install --name mongo stable/mongodb```

If you get an error about tiller version, update the HELM version on the server, upgrade using:

```helm init --upgrade```

If you still have issues the versions may need amending directly on the master nodes using the command below:

```ssh azureuser@<ClusterFQDN>.awesteurope.cloudapp.azure.com sudo sed -i s/'2.6.1'/'2.7.0'/g /etc/kubernetes/addons/kube-tiller-deployment.yaml && helm init --upgrade```

The ClusterFQDN can be found by running ```az acs list -g <ResourceGroupName>```

## Install RabbitMQ using Helm

```helm install --name rabbit --set rabbitmqUsername=admin,rabbitmqPassword=my-password  stable/rabbitmq```

## Deploy Kubernetes Objects

1. Download or clone the repo from ```https://github.com/shanepeckham/SwanseaHack```

2. Add the URLs provided below for MongoDB and RabbitMQ to the Kubernetes YAML files for the three custom containers using your preferred editor.

     MongoDB: ```mongodb://mongo-mongodb```

     RabbitMQ: ```amqp://admin:my-password@rabbit-rabbitmq:5672```

3. Deploy the objects using:

    ```kubectl create -f ./Kubernetes/```

3. Retrieve and record the order capture endpoint:

    ```kubectl get services```

3. Retrieve the record the fulfillorder pod name:

    ```kubectl get pods```

## Test and confirm order processed

1. Visit ```http://<captureorder_externalip>:8080/swagger/``` ,click "Try It" and Execute a request.

2. View the processed order json files:

```kubectl exec -it <fulfillorder_pod_name> ls /orders```
