use borsh::{BorshDeserialize, BorshSerialize};
use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};


/// Define the type of state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct AccountData {
    pub result: f32
}

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The accounts affected in contract
    instruction_data: &[u8], // External Data
) -> ProgramResult {
    msg!("Rust program entrypoint");

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account
    let account = next_account_info(accounts_iter).unwrap();

    // The account must be owned by the program in order to modify its data
    if account.owner != program_id {
        msg!("Greeted account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    msg!("{:?}", instruction_data);

    // Process
    let mut bytes = &instruction_data[..];
    let numerator: u32 = bytes.read_u32::<BigEndian>().unwrap();
    let denominator: u32 = bytes.read_u32::<BigEndian>().unwrap();

    // Get the result
    let mut account_data = AccountData::try_from_slice(&account.data.borrow()).unwrap();
    account_data.result = numerator as f32 / denominator as f32;
    account_data.serialize(&mut &mut account.data.borrow_mut()[..])?;

    msg!("Account data {} / {} = {}!", numerator, denominator, account_data.result);

    Ok(())
}

// Unit tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_program::clock::Epoch;
    use std::mem;

    #[test]
    fn unit_test() {
        let program_id = Pubkey::default();
        let key = Pubkey::default();
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        let owner = Pubkey::default();
        let account = AccountInfo::new(
            &key,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
            Epoch::default(),
        );

        let accounts = vec![account];
        assert_eq!(AccountData::try_from_slice(&accounts[0].data.borrow()).unwrap().result, 0.0);

        {
            let mut instruction_data = vec![];
            instruction_data.write_u32::<BigEndian>(60).unwrap();
            instruction_data.write_u32::<BigEndian>(30).unwrap();
            process_instruction(&program_id, &accounts, &instruction_data).unwrap();
            assert_eq!(AccountData::try_from_slice(&accounts[0].data.borrow()).unwrap().result, 2.0);
        }

        {
            let mut instruction_data = vec![];
            instruction_data.write_u32::<BigEndian>(5).unwrap();
            instruction_data.write_u32::<BigEndian>(2).unwrap();
            process_instruction(&program_id, &accounts, &instruction_data).unwrap();
            assert_eq!(AccountData::try_from_slice(&accounts[0].data.borrow()).unwrap().result, 2.5);
        }
    }
}
