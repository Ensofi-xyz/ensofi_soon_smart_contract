# Enso Smartcontract (SOON)

## Build and deploy program

### Prepare solana config

```
solana config set -u "https://rpc.devnet.soo.network/rpc" -k ./wallets/dev/enso_deployer.json
```

### Build program

Go into Anchor.toml and add the program id mainnet, devnet, testnet below

```
[programs.mainnet]
enso_lending = "<program_id_in_mainnet>"

[programs.devnet]
enso_lending = "<program_id_in_devnet>"

[programs.testnet]
enso_lending = "<program_id_in_testnet>"
```

Update the path file of wallet that is authority of program and change cluster to mainnet/devnet/testnet

```
[provider]
cluster = "mainnet"
wallet = "<path_file_of_wallet>"
```

Build command

- Mainnet

```bash
$ anchor build -- --feature mainnet
```

- Devnet

```bash
$ anchor build -- --features devnet dev
```

- Beta test

```bash
$ anchor build -- --features devnet beta-test
```

### Deploy

```bash
$ solana program deploy ./target/deploy/enso_lending.so
```

## Setup setting onchain data

Update env before run script

```
cp .env.example .env
```

Setup env

```
RPC_URL='https://rpc.devnet.soo.network/rpc'
PROGRAM_ID=
DURATION_TO_SECOND=
USDC_MINT_ADDRESS=
USDC_USD_PRICE_FEED_NAME=
ETH_USD_PRICE_FEED_NAME=
ETH_MINT_ADDRESS=
```

Run script Init setting onchain

Devnet

```bash
ts-node ./scripts/dev/init-setting-onchain.ts
```

Beta test

```bash
ts-node ./scripts/testnet/init-setting-onchain.ts
```

## Trouble shooting when deploy

### 1.Insufficient fund

```
...
Error: Account a23QvEb6Q3adWurmUVbJ9YfAa6tiEzZBdXB8cvmhViS has insufficient funds for spend...
```

This error occur because the authority wallet does not have enough fund to action the transaction, please send fund to the wallet and redeployed again

### 2.Account data to small

```
...
Error: Deploying program failed: RPC response error -32002: Transaction simulation failed: Error processing Instruction 0: account data too small for instruction [3 log messages]
```

This error occur because the space of program deployed in onchain is less the the space that program need when deployed

Step to extends more space to deployed

Get the current bytes of the program will deployed with this command

```bash
$ ls -l  ./target/deploy
```

Result

```
total 1544
-rw-------  1 minhnguyen  staff     226 Jul 16 01:27 enso_lending-keypair.json
-rwxr-xr-x  1 minhnguyen  staff  785208 Jul 16 02:07 enso_lending.so
```

Go to sol scan or solana explorer to get the current space of program

1. Navigate to the explorer, find the program by pasted program id
2. Get the id of Executable Data Account and pasted into explorer
3. Get the number in field Data Size (Bytes)

Subtract the current bytes in local with current data size had find

```
Extend addition bytes = 100 + <current_bytes_of_program_build_in_local> - <current_bytes_of_program_in_onchain>
```

Command extend program

```bash
$ solana program extend <program_id> <Addition bytes> --keypair <file_path_of_wallet>
```

And the redeployed with the command above

### 3. Backup recovery file

```
=====================================================================
Recover the intermediate account's ephemeral keypair file with
`solana-keygen recover` and the following 12-word seed phrase:
=====================================================================
cat swing tuition soda power garbage nominee real sun term doll mercy
=====================================================================
To resume a deploy, pass the recovered keypair as the
[BUFFER_SIGNER] to `solana program deploy` or `solana program write-buffer'.
Or to recover the account's lamports, pass it as the
[BUFFER_ACCOUNT_ADDRESS] argument to `solana program close`.
=====================================================================
Error: 2 write transactions failed
```

`solana program deploy` will deploy a new program or upgrade an existing program if used with the `--program-id` and `--upgrade-authority` flags, while `solana program write-buffer` will just write to a buffer to be used for an eventual upgrade.
The error message says to use the recovered keypair as the `[BUFFER_SIGNER]` to `solana program deploy`, so let's follow this command:

```
solana-keygen recover -o recovered.json
```

And then paste 12-word seed phrase to the terminal.
When we have the keypair in recovered.json, let try to deploy again with recovery

```
solana program deploy /Users/kiemtran/xlend-smart-contract/target/deploy/enso_lending.so --buffer /Users/kiemtran/xlend-smart-contract/recovered.json
```

## Note

### Issue when deploy with Anchor

- Blockhash expired, and maximum retry is only 5 times

```bash
Blockhash expired. 0 retries remaining
Error: Data writes to account failed: Custom error: Max retries exceeded
There was a problem deploying: Output { status: ExitStatus(unix_wait_status(256)), stdout: "", stderr: "" }.
```

- Cannot resume deploy with buffers
- To close buffers to get back lamports

```bash
solana program close --authority "{deployer wallet.json}" --buffers
```

### Deploy with solana cli

1. Check solana config

```bash
solana config get
```

2. Set solana config

```bash
solana config set -u "{rpc url}" -k "{deployer wallet.json}"
```

3. Deploy: set priority fee & increase attempts

- Refer: https://solana.com/docs/programs/deploying

```bash
solana program deploy "{deployer wallet.json}" --with-compute-unit-price 5000 --max-sign-attempts 1000 --use-rpc
```
