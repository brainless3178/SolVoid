// Type declarations for circomlibjs
declare module 'circomlibjs' {
    /**
     * Build Poseidon hash function with BN254 field parameters
     * @returns Promise resolving to a Poseidon hash function
     */
    export function buildPoseidon(): Promise<PoseidonHashFunction>;

    /**
     * Poseidon hash function interface
     */
    export interface PoseidonHashFunction {
        /**
         * Compute Poseidon hash of inputs
         * @param inputs Array of BigInt or string inputs
         * @returns Uint8Array containing the hash result
         */
        (inputs: (bigint | string)[]): Uint8Array;

        /**
         * Field arithmetic utilities
         */
        F: {
            /**
             * Convert field element to string
             * @param element The field element (Uint8Array)
             * @returns String representation of the field element
             */
            toString(element: Uint8Array): string;

            /**
             * Convert string to field element
             * @param str String to convert
             * @returns Field element
             */
            fromString(str: string): Uint8Array;
        };
    }

    /**
     * Build Eddsa signature utilities
     */
    export function buildEddsa(): Promise<any>;

    /**
     * Build Baby Jubjub utilities  
     */
    export function buildBabyjub(): Promise<any>;
}
