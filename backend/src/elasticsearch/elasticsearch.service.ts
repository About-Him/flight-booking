import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

interface FlightInstanceSearchDoc {
  id: string;
  instanceId: string;
  flightId: string;
  airlineId?: string;
  airlineName?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  departureAt: Date | string;
  arrivalAt: Date | string;
  status: string;
  availableSeats?: number;
  economyPrice?: number;
  businessPrice?: number;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly client: Client;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get<string>('ELASTICSEARCH_URL') || 'http://localhost:9200',
    });
  }

  async onModuleInit() {
    try {
      await this.ensureFlightInstancesIndex();
    } catch {
      return;
    }
  }

  private async ensureFlightInstancesIndex() {
    const exists = await this.client.indices.exists({ index: 'flight_instances' });
    if (exists) {
      return;
    }

    await this.client.indices.create({
      index: 'flight_instances',
      mappings: {
        properties: {
          id: { type: 'keyword' },
          instanceId: { type: 'keyword' },
          flightId: { type: 'keyword' },
          airlineId: { type: 'keyword' },
          airlineName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          flightNumber: { type: 'keyword' },
          origin: { type: 'keyword' },
          destination: { type: 'keyword' },
          departureAt: { type: 'date' },
          arrivalAt: { type: 'date' },
          status: { type: 'keyword' },
          availableSeats: { type: 'integer' },
          economyPrice: { type: 'float' },
          businessPrice: { type: 'float' },
        },
      },
    });
  }

  async indexFlightInstance(doc: FlightInstanceSearchDoc) {
    try {
      await this.client.index({
        index: 'flight_instances',
        id: doc.id,
        document: {
          ...doc,
          departureAt: new Date(doc.departureAt).toISOString(),
          arrivalAt: new Date(doc.arrivalAt).toISOString(),
        },
      });
    } catch {
      return;
    }
  }

  async deleteFlightInstance(id: string) {
    await this.client.delete({ index: 'flight_instances', id }).catch(() => null);
  }

  async searchOneWay(origin: string, destination: string, date: string) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    try {
      const result = await this.client.search({
        index: 'flight_instances',
        query: {
          bool: {
            must: [
              { term: { origin: origin.toUpperCase() } },
              { term: { destination: destination.toUpperCase() } },
              { term: { status: 'SCHEDULED' } },
              { range: { departureAt: { gte: start.toISOString(), lt: end.toISOString() } } },
            ],
          },
        },
        sort: [{ departureAt: { order: 'asc' } }],
      });

      return result.hits.hits.map((hit) => hit._source);
    } catch {
      return [];
    }
  }
}
