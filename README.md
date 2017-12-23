# KCoin blockchain reference implementation

This project is a **VERY SIMPLE** implementation of Bitcoin blockchain protocol (ignore P2P and multiple miners) for demonstration of CTT522 Final project using Node.js, Restify, Knex with PostgreSQL database. Vietnamese guide is available on wiki.

## Hosting

API is hosting at [https://api.kcoin.club](https://api.kcoin.club)

## Installation

1. Install docker

2. Create database and API server

```
$ docker-compose up
```

3. Run database migrations

```
$ docker-compose run --rm api yarn knex migrate:latest
```

4. Open URL [http://localhost:5000/init](http://localhost:5000/init) to init blockchain by creating genesis block. Remember to store the private key, public key and address of miner to create transactions.

## Reference

* Bitcoin protocol documentation: [https://en.bitcoin.it/wiki/Protocol](https://en.bitcoin.it/wiki/Protocol)

* Bitcoin protocol rule: [https://en.bitcoin.it/wiki/Protocol_rules](https://en.bitcoin.it/wiki/Protocol_rules)

* Dumbcoin - An educational python implementation of a bitcoin-like blockchain: [https://github.com/julienr/ipynb_playground/blob/master/bitcoin/dumbcoin/dumbcoin.ipynb](https://github.com/julienr/ipynb_playground/blob/master/bitcoin/dumbcoin/dumbcoin.ipynb)

## License

This project is licensed under the MIT License - see the LICENSE file for details
