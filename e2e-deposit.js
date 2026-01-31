const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, SystemProgram, Connection, TransactionInstruction, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const crypto = require('crypto');
const bs58 = require('bs58');

async function main() {
    const connection = new Connection("https://zk-edge.surfnet.dev:8899", 'confirmed');
    const secretKey = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET || '/home/elliot/.config/solana/id.json'));
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    const programId = new PublicKey("3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan");

    // Calculate sighash for "global:deposit"
    const sighash = crypto.createHash('sha256').update('global:deposit').digest().slice(0, 8);

    // Generate deposit data
    const commitment = crypto.randomBytes(32);
    const amount = new anchor.BN(1000000); // 0.001 SOL

    // Borsh encode args
    const argsBuffer = Buffer.concat([
        commitment,
        amount.toArrayLike(Buffer, 'le', 8)
    ]);

    const data = Buffer.concat([sighash, argsBuffer]);

    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state")], programId);
    const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from("root_history")], programId);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], programId);

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: statePda, isSigner: false, isWritable: true },
            { pubkey: rootHistoryPda, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data
    });

    const tx = new Transaction().add(instruction);
    try {
        const signature = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet]);
        console.log("Deposit Success! Sig:", signature);

        const note = {
            commitment: commitment.toString('hex'),
            amount: amount.toString()
        };
        fs.writeFileSync('.deposit-note-e2e.json', JSON.stringify(note, null, 2));
    } catch (err) {
        console.error("Deposit Failed:", err);
    }
}

main();
