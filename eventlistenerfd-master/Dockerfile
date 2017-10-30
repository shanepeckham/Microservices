FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/eventlistener
WORKDIR /usr/src/eventlistener

ENV EVENTHUBCONNSTRING=
ENV EVENTHUBPATH=
ENV INSIGHTSKEY=
ENV SOURCE=
ENV PROCESSENDPOINT=
ENV PARTITIONKEY=
ENV PAUSE=

# Install app dependencies
RUN npm install

# Bundle app source
ADD / . 

CMD [ "node", "eventlistener.js" ]