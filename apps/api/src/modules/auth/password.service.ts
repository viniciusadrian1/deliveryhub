import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 v2 defaults: Argon2id, memoryCost=19456, timeCost=2, parallelism=1.
@Injectable()
export class PasswordService {
  hash(plaintext: string): Promise<string> {
    return hash(plaintext);
  }

  verify(passwordHash: string, plaintext: string): Promise<boolean> {
    return verify(passwordHash, plaintext);
  }
}
