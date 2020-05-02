# https://hub.docker.com/_/node
FROM node:12.14.1-alpine

#Exposing the port
EXPOSE 5000

#Current working directory
WORKDIR '/app'

#Copying the installation files
COPY package.json .
COPY yarn.lock .
RUN yarn install
COPY . .

CMD ["sh", "yarn", "build", "start", "--env.BACKEND=http://backend:8000", "--host", "0.0.0.0"]