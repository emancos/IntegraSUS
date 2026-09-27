import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService
  ) {}

  async validateClient(clientId: string, clientSecret: string): Promise<any> {
    const query = 'SELECT * FROM tb_clients WHERE client_id = $1';
    const res = await this.dataSource.query(query, [clientId]);

    if (res.length > 0) {
      const client = res[0];
      const isMatch = await bcrypt.compare(clientSecret, client.client_secret);
      if (isMatch) {
        return { clientId: client.client_id, description: client.description };
      }
    }
    return null;
  }

  async login(clientId: string, clientSecret: string) {
    const client = await this.validateClient(clientId, clientSecret);
    if (!client) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: client.clientId, description: client.description };
    return {
      access_token: this.jwtService.sign(payload),
      expires_in: '1h'
    };
  }
}
