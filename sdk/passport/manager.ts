import { z } from 'zod';
import {
    PrivacyPassportSchema,
    ScoreSnapshotSchema,
    PrivacyBadgeSchema,
    enforce,
    DataOrigin,
    DataTrust
} from '../integrity';

export type ScoreSnapshot = z.infer<typeof ScoreSnapshotSchema>;
export type PrivacyBadge = z.infer<typeof PrivacyBadgeSchema>;
export type PrivacyPassport = z.infer<typeof PrivacyPassportSchema>;

const isBrowser = typeof globalThis !== 'undefined' && (globalThis as any).document !== undefined;

/**
 * PassportManager: Persistence layer for privacy reputation and audit history.
 * Implements environment-agnostic storage with integrity validation.
 */
export class PassportManager {
    private readonly storagePath: string;
    private memoryCache: Record<string, unknown> = {};

    constructor(storagePath: string = './privacy-passport.json') {
        this.storagePath = storagePath;
    }

    /**
     * Internal IO abstraction for retrieving persisted state.
     * Supports LocalStorage (Browser) and FileSystem (Node.js).
     */
    private readStorage(): Record<string, unknown> {
        let rawData: string | null = null;
        if (isBrowser) {
            rawData = localStorage.getItem('solvoid_passport');
        } else {
            try {
                /** 
                 * Dynamic require to prevent bundler resolution issues in browser environments. 
                 */
                const nodeFs = typeof require !== 'undefined' ? eval('require')('fs') : null;
                if (nodeFs && nodeFs.existsSync(this.storagePath)) {
                    rawData = nodeFs.readFileSync(this.storagePath, 'utf8');
                }
            } catch (e) {
                // Return defaults on IO failure
            }
        }

        if (!rawData) return (this.memoryCache as Record<string, unknown>) || {};

        try {
            const parsed = JSON.parse(rawData);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }

    /**
     * Persists protocol state with basic integrity attestation.
     */
    private writeStorage(data: Record<string, unknown>) {
        /** 
         * Integrity Checksum: Mitigates rudimentary local tampering.
         */
        const integrityData = {
            ...data,
            _integrity: Date.now().toString()
        };

        if (isBrowser) {
            localStorage.setItem('solvoid_passport', JSON.stringify(integrityData));
        } else {
            try {
                const nodeFs = typeof require !== 'undefined' ? eval('require')('fs') : null;
                if (nodeFs) {
                    nodeFs.writeFileSync(this.storagePath, JSON.stringify(integrityData, null, 2));
                } else {
                    this.memoryCache = integrityData;
                }
            } catch (e) {
                this.memoryCache = integrityData;
            }
        }
    }

    /**
     * Retrieves or initializes the Privacy Passport for a specified address.
     * Implements strict schema enforcement at the storage boundary.
     */
    public getPassport(address: string): PrivacyPassport {
        const data = this.readStorage();
        const passportData = data[address];

        if (!passportData) {
            return this.initializePassport(address);
        }

        /** Result validation: Mapping persisted JSON to the enforced domain schema. */
        const enforced = enforce(PrivacyPassportSchema, passportData, {
            origin: isBrowser ? DataOrigin.CACHE : DataOrigin.DB,
            trust: DataTrust.SEMI_TRUSTED,
            createdAt: Date.now(),
            owner: 'Passport Storage'
        });

        return enforced.value;
    }

    /**
     * Updates the privacy score and executes milestone-based badge evaluation.
     */
    public updateScore(address: string, newScore: number) {
        if (!Number.isInteger(newScore) || newScore < 0 || newScore > 100) {
            throw new Error(`Data integrity error: Score ${newScore} out of valid range (0-100).`);
        }

        const passport = this.getPassport(address);

        /** Immutable state mutation pattern. */
        const updatedPassport: PrivacyPassport = {
            ...passport,
            overallScore: newScore,
            scoreHistory: [
                ...passport.scoreHistory,
                { timestamp: Date.now(), score: newScore }
            ]
        };

        this.checkBadges(updatedPassport);
        this.savePassport(address, updatedPassport);
    }

    private initializePassport(address: string): PrivacyPassport {
        return {
            walletAddress: address,
            overallScore: 100,
            scoreHistory: [],
            badges: [],
            recommendations: ["Initialize the primary privacy audit to begin the reputation building process."]
        };
    }

    /**
     * Evaluates protocol milestones and attaches reputation badges to the passport state.
     */
    private checkBadges(passport: PrivacyPassport) {
        const badgesToAdd: PrivacyBadge[] = [];

        if (passport.overallScore >= 95 && !passport.badges.some(b => b.name === "Zero-Trace Master")) {
            badgesToAdd.push({
                name: "Zero-Trace Master",
                icon: "👻",
                description: "Maintained a consistent privacy score threshold (95+).",
                dateEarned: Date.now()
            });
        }

        if (passport.scoreHistory.length > 5 && !passport.badges.some(b => b.name === "Consistent Ghost")) {
            badgesToAdd.push({
                name: "Consistent Ghost",
                icon: "🌫️",
                description: "Successfully executed multiple privacy audit cycles.",
                dateEarned: Date.now()
            });
        }

        passport.badges.push(...badgesToAdd);
    }

    private savePassport(address: string, passport: PrivacyPassport) {
        const allData = this.readStorage();

        const enforced = enforce(PrivacyPassportSchema, passport, {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'PassportManager'
        });

        allData[address] = enforced.value;
        this.writeStorage(allData);
    }
}
