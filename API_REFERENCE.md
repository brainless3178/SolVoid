# SolVoid Relayer API Reference

Technical specification for our privacy-preserving transaction relay service. We provide this service to enable gasless (bounty-based) transactions and onion-routed submission paths.

---

## Service Endpoints

### `GET /status`

We use this endpoint to monitor service health and protocol metrics.

**Response Structure:**
```json
{
  "status": "operational",
  "metrics": {
    "relayed": 1234,
    "activePeers": 5
  },
  "version": "1.0.0"
}
```

---

### `GET /commitments`

We provide this route to sync the Merkle tree state. Our client SDK fetches this data to generate membership proofs.

**Notes on Implementation**: 
- In test environments where the program is not deployed, we fall back to a "Mock State" mode.
- We return the current Merkle root and all populated leaf hashes.

---

### `POST /relay`

The primary endpoint for transaction submission. We support both direct relaying and multi-hop onion routing.

**Payload Specification:**
| Field | Type | Description |
|-------|------|-------------|
| `transaction` | string | Base64-encoded VersionedTransaction |
| `hops` | number | Desired onion routing depth (Max 5) |

---

## Internal Relay Mechanics

### Multi-Hop Onion Routing

We implement a layered encryption scheme for transaction routing. Our relayers only know the immediate next hop, ensuring the originator's IP and metadata are decoupled from the final on-chain submission.

### Bounty System

Our relayers collect a flat bounty fee (specified in the protocol configuration) to cover compute units and network fees. We automatically deduct this during the ZK withdrawal validation on-chain.

---

## Security and Rate Limiting

We enforce the following standards across our relay network:
- **Rate Limiting**: 100 requests per 60s window per IP.
- **Payload Validation**: All payloads undergo strict schema enforcement prior to processing.
- **Simulation**: We simulate all transactions against the current cluster state before broadcasting.
