FROM node:8.9

COPY package.json yarn.lock /usr/src/app/

WORKDIR /usr/src/app

RUN yarn install

COPY . /usr/src/app

# Run app as node user
USER node

# Wait for kong and database
CMD ["npm", "start"]
