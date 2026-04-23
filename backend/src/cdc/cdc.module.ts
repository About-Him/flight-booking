import { Module } from '@nestjs/common';
import { CdcConsumerService } from './cdc-consumer.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  providers: [CdcConsumerService],
})
export class CdcModule {}
