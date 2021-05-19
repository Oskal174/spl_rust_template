/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Account,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {
  getPayer,
  getRpcUrl,
  newAccountWithLamports,
  readAccountFromFile,
} from './utils';


let connection: Connection;
let payerAccount: Account;
let programId: PublicKey;
let appAccountPubkey: PublicKey;

const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'smartcontract_template.so');
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'smartcontract_template-keypair.json');

// The state of a app account managed by the program
class AccountData {
  result = 0.0;
  constructor(fields: {result: number} | undefined = undefined) {
    if (fields) {
      this.result = fields.result;
    }
  }
}

// Borsh schema definition for account data
const AccountDataSchema = new Map([
  [AccountData, {kind: 'struct', fields: [['result', 'u32']]}],
]);
const DATA_SIZE = borsh.serialize(AccountDataSchema, new AccountData()).length;


export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

// Establish an account to pay for everything
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payerAccount) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the app account
    fees += await connection.getMinimumBalanceForRentExemption(DATA_SIZE);
    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    try {
      // Get payer from cli config
      payerAccount = await getPayer();
    } catch (err) {
      throw 'Error: cannot find payer keypair in solana config';
    }
  }

  const lamports = await connection.getBalance(payerAccount.publicKey);
  if (lamports < fees) {
    throw new Error('Error: not enough SOL to pay fee:' + fees);
  }

  console.log('Using account', payerAccount.publicKey.toBase58(), 'containing', lamports / LAMPORTS_PER_SOL, 'SOL to pay for fees');
}

export async function checkProgramDeployed(): Promise<void> {
  // Read program id from keypair file
  try {
    const programAccount = await readAccountFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programAccount.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/smartcontract_template.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy <prog_name.so>`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address of a app account from the program so that it's easy to find later.
  const APP_ACC_SEED = 'app';
  appAccountPubkey = await PublicKey.createWithSeed(
    payerAccount.publicKey,
    APP_ACC_SEED,
    programId,
  );

  // Check if the app account has already been created
  const appAccount = await connection.getAccountInfo(appAccountPubkey);
  if (appAccount === null) {
    console.log('Creating appAccount',appAccountPubkey.toBase58(),);
    const lamports = await connection.getMinimumBalanceForRentExemption(DATA_SIZE,);

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payerAccount.publicKey,
        basePubkey: payerAccount.publicKey,
        seed: APP_ACC_SEED,
        newAccountPubkey: appAccountPubkey,
        lamports,
        space: DATA_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payerAccount]);
  }
  else {
    console.log('Using appAccount', appAccountPubkey.toBase58());
  }
}

export async function runProgram(numerator: number, denominator: number): Promise<void> {
  console.log('Running smartcontract with appAccount', appAccountPubkey.toBase58(),'and programId',programId.toBase58());

  let data = Buffer.alloc(8);
  data.writeInt32BE(numerator, 0);
  data.writeInt32BE(denominator, 4);

  const instruction = new TransactionInstruction({
    keys: [{pubkey: appAccountPubkey, isSigner: false, isWritable: true}],
    programId,
    data: data,
  });

  await sendAndConfirmTransaction(connection, new Transaction().add(instruction), [payerAccount]);
}

export async function checkResult(): Promise<void> {
  const accountInfo = await connection.getAccountInfo(appAccountPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the app account';
  }

  const data = borsh.deserialize(AccountDataSchema, AccountData, accountInfo.data,);

  console.log(appAccountPubkey.toBase58(),'result = ',data.result);
}
