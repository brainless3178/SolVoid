// Type declarations for tweetnacl
declare module 'tweetnacl' {
    export interface BoxKeyPair {
        publicKey: Uint8Array;
        secretKey: Uint8Array;
    }

    export interface SignKeyPair {
        publicKey: Uint8Array;
        secretKey: Uint8Array;
    }

    export const box: {
        keyPair(): BoxKeyPair;
        keyPair_fromSecretKey(secretKey: Uint8Array): BoxKeyPair;
        publicKeyLength: number;
        secretKeyLength: number;
        sharedKeyLength: number;
        nonceLength: number;
        overheadLength: number;
        (message: Uint8Array, nonce: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;
        open(box: Uint8Array, nonce: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array | null;
        before(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;
        after(message: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array;
        open_after(box: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array | null;
    };

    export const sign: {
        keyPair(): SignKeyPair;
        keyPair_fromSecretKey(secretKey: Uint8Array): SignKeyPair;
        keyPair_fromSeed(seed: Uint8Array): SignKeyPair;
        publicKeyLength: number;
        secretKeyLength: number;
        seedLength: number;
        signatureLength: number;
        (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
        open(signedMessage: Uint8Array, publicKey: Uint8Array): Uint8Array | null;
        detached: {
            (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
            verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
        };
    };

    export const secretbox: {
        keyLength: number;
        nonceLength: number;
        overheadLength: number;
        (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
        open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    };

    export const hash: {
        hashLength: number;
        (message: Uint8Array): Uint8Array;
    };

    export function verify(x: Uint8Array, y: Uint8Array): boolean;
    export function randomBytes(n: number): Uint8Array;

    const nacl: {
        box: typeof box;
        sign: typeof sign;
        secretbox: typeof secretbox;
        hash: typeof hash;
        verify: typeof verify;
        randomBytes: typeof randomBytes;
    };

    export default nacl;
}
