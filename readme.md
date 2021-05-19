**prepare local test cluster**

Set CLI config url to localhost cluster
```
$ solana config set --url localhost
```

Create CLI Keypair
If this is your first time using the Solana CLI, you will need to generate a new keypair:
```
$ solana-keygen new
```

Start a local Solana cluster:
```
$ solana-test-validator --ledger <DIR>
```

**build**

Depencies
```
$ npm install
```

```
$ npm run build-rust

$ solana program deploy dist/program/helloworld.so

$ npm run start
```
