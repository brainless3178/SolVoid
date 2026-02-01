
                        pragma circom 2.0.0;
                        template TestHash() {
                            signal input in[2];
                            signal output out;
                            component poseidon = Poseidon(2);
                            poseidon.inputs[0] <== in[0];
                            poseidon.inputs[1] <== in[1];
                            poseidon.out ==> out;
                        }
                        component main = TestHash();
                    