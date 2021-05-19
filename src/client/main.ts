import {
  establishConnection,
  establishPayer,
  checkProgramDeployed,
  runProgram,
  checkResult,
} from './lib';

async function main() {
  console.log("Start ts-client...");

  await establishConnection();
  await establishPayer();
  await checkProgramDeployed();

  let numerator = 15;
  let denominator = 5;
  await runProgram(numerator, denominator);

  await checkResult();
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
