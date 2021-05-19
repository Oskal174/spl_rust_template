use borsh::de::BorshDeserialize;
use byteorder::{BigEndian, WriteBytesExt};
use smartcontract_template::processor::{process_instruction, AccountData};
use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction::Transaction,
};

use std::convert::TryInto;
use std::mem;

// Functional tests
#[tokio::test]
async fn test_smartcontract_template() {
    let program_id = Pubkey::new_unique();
    let app_pubkey = Pubkey::new_unique();

    let mut program_test = ProgramTest::new(
        "template_contract", // Run the BPF version with `cargo test-bpf`
        program_id,
        processor!(process_instruction), // Run the native version with `cargo test`
    );

    program_test.add_account(
        app_pubkey,
        Account {
            lamports: 5,
            data: vec![0_u8; mem::size_of::<f32>()],
            owner: program_id,
            ..Account::default()
        },
    );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // Verify app account initialized
    let app_account = banks_client
        .get_account(app_pubkey)
        .await
        .expect("get_account")
        .expect("app_account not found");

    assert_eq!(AccountData::try_from_slice(&app_account.data).unwrap().result, 0.0);

    // Proc
    let mut instruction_data_vec = Vec::new();
    instruction_data_vec.write_u32::<BigEndian>(2060).unwrap();
    instruction_data_vec.write_u32::<BigEndian>(2).unwrap();
    let instruction_data: [u8; 8] = instruction_data_vec.try_into().unwrap();
    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &instruction_data,
            vec![AccountMeta::new(app_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // Check
    let app_account = banks_client
        .get_account(app_pubkey)
        .await
        .expect("get_account")
        .expect("app_account not found");

    assert_eq!(AccountData::try_from_slice(&app_account.data).unwrap().result, 1030.0);

    // Proc
    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &[0_u8,0,0,10, 0,0,0,5],
            vec![AccountMeta::new(app_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // Check
    let app_account = banks_client
        .get_account(app_pubkey)
        .await
        .expect("get_account")
        .expect("app_account not found");

    assert_eq!(AccountData::try_from_slice(&app_account.data).unwrap().result, 2.0);
}
