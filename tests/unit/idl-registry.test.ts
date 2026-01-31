import { describe, it, expect, beforeEach } from '@jest/globals';
import { IdlRegistry } from '../../sdk/semantics/idl-registry';
import { Idl } from '../../sdk/semantics/types';
import { Keypair } from '@solana/web3.js';

describe('IdlRegistry', () => {
    let registry: IdlRegistry;

    beforeEach(() => {
        registry = new IdlRegistry();
    });

    it('should load pre-seeded system program IDL', async () => {
        const idl = await registry.fetchIdl('11111111111111111111111111111111');
        expect(idl?.name).toBe('system_program');
    });

    it('should load pre-seeded SPL token IDL', async () => {
        const idl = await registry.fetchIdl('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        expect(idl?.name).toBe('spl_token');
    });

    it('should register custom IDLs', () => {
        const customIdl: Idl = {
            version: '0.1.0',
            name: 'custom_program',
            instructions: []
        };
        const programId = Keypair.generate().publicKey.toBase58();
        registry.registerIdl(programId, customIdl);

        const saved = (registry as any).cache.get(programId);
        expect(saved?.name).toBe('custom_program');
    });

    it('should return null for unknown programs', async () => {
        const unknownProgramId = Keypair.generate().publicKey.toBase58();
        const idl = await registry.fetchIdl(unknownProgramId);
        expect(idl).toBeNull();
    });

    it('should handle invalid public keys gracefully in fetchIdl', async () => {
        await expect(registry.fetchIdl('invalid-key')).rejects.toThrow(/Invalid Base58 Public Key/);
    });
});
