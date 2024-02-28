import { Client, DiscordEmbeds } from '@live-apps/discord';
import { Inject, Injectable } from '@nestjs/common';
import { PROVIDER_TYPES } from 'src/common/constants/provider.types';
import { DiscordEmbedField } from 'src/common/interface/discord-embeds.interface';
import { IGuildMessage } from 'src/common/interface/guild.interface';
import { AxiosService } from 'src/common/services/connectivity/axios.service';
import { EsService } from 'src/common/services/connectivity/es.service';
import { RedisService } from 'src/common/services/connectivity/redis.service';
import { GuildRepository } from 'src/modules/guild/repository/guild.respository';

interface ServiceStats {
  service: string;
  isAvailable: boolean;
  latency: number | null; //milliseconds
}

@Injectable()
export class HealthService {
  private kittyChanAPI = 'https://api.kittychan.live/';
  private DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

  constructor(
    @Inject(PROVIDER_TYPES.DiscordClient)
    private readonly discordClient: Client,
    @Inject(GuildRepository) private readonly guildRepo: GuildRepository,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(EsService) private readonly esService: EsService,
    @Inject(AxiosService) private readonly axiosService: AxiosService,
  ) {}

  async check(guildId: string) {
    const [
      mongo,
      redis,
      es,
      ff,
      queue,
      rest,
      liveAppsDiscordCache,
      liveAppsDiscordAPI,
    ] = await Promise.all([
      this.mongo(guildId),
      this.redis(),
      this.es(),
      this.featureFlag(guildId),
      this.queue(),
      this.rest(),
      this.liveAppsDiscordCache(guildId),
      this.liveAppsDiscordAPI(guildId),
    ]);

    const serviceStats: ServiceStats[] = [
      mongo,
      redis,
      es,
      queue,
      ff,
      rest,
      liveAppsDiscordCache,
      liveAppsDiscordAPI,
    ];

    return serviceStats;
  }

  /** */
  async validateCommand({ guildId, channelId, plainMessage }: IGuildMessage) {
    const message = plainMessage.trim().toLowerCase();
    const messageChunk = message.split(' ');

    ///Check if kitty chan tagged
    if (messageChunk[0] !== `<@${this.DISCORD_CLIENT_ID}>`) return false;

    /**Service Availability */
    if (messageChunk[1] === 'ping') {
      await this.discord_command(guildId, channelId);
      return true;
    }

    return false;
  }

  /**Build and send service status to discord channel
   * Used by Commands
   */
  async discord_command(guildId: string, channelId: string) {
    const serviceStats = await this.check(guildId);

    const embeds: DiscordEmbeds = {
      title: 'kitty chan Service Stats 🛠',
      color: 10181010,
      description: `kitty chan tries fetching info from all dependent services connected to your 
Guild (Discord Server) - \`${guildId}\`

Certain features won't work unless kitty chan can access these services. 💡`,
      fields: [],
      footer: {
        text: `Server Region - Mumbai  |  Live Apps 💜`,
      },
    };

    const servicesPerRow = 3;
    let currentRow: DiscordEmbedField[] = [];

    for (const stats of serviceStats) {
      const { service, isAvailable, latency } = stats;

      let statusEmoji = '❌';

      if (isAvailable) {
        statusEmoji = '✨';
      }

      let latencyText = 'N/A';
      if (latency !== null) {
        latencyText = `${latency.toFixed(2)} ms`;
      }

      const serviceField: DiscordEmbedField = {
        name: `${service}`,
        value: `${statusEmoji} Delay: ${latencyText}`,
        inline: true,
      };

      currentRow.push(serviceField);

      if (currentRow.length === servicesPerRow) {
        embeds.fields?.push(...currentRow);
        embeds.fields?.push({ name: '', value: '' }); // Add an empty field for spacing
        currentRow = [];
      }
    }

    if (currentRow.length > 0) {
      embeds.fields?.push(...currentRow);
      embeds.fields?.push({ name: '', value: '' }); // Add an empty field for spacing
    }

    await this.discordClient.message.sendEmbed(channelId, [embeds]);
  }

  /**MongoDB - Check by fetching home guild */
  private async mongo(guildId: string) {
    const start = performance.now();
    const getGuild = await this.guildRepo.getByGuildId(guildId);
    const end = performance.now();

    if (!getGuild) {
      return {
        service: 'MongoDB',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'MongoDB',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**Redis - Check using Redis Ping*/
  private async redis() {
    const start = performance.now();
    const getGuildFF = await this.redisService.ping();
    const end = performance.now();

    if (!getGuildFF) {
      return {
        service: 'Redis',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'Redis',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**ES - Check using Elastic Search Ping*/
  private async es() {
    const start = performance.now();
    const esPing = (await this.esService.ping()).body;
    const end = performance.now();

    if (!esPing) {
      return {
        service: 'Elastic Search',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'Elastic Search',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**FeatureFlag - Check by fetching home guild Feature Flag*/
  private async featureFlag(guildId: string) {
    const start = performance.now();
    const getGuildFF = await this.redisService.get(`guild:${guildId}:flags`);
    const end = performance.now();

    if (!getGuildFF) {
      return {
        service: 'FeatureFlag',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'FeatureFlag',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**RabbitMQ - pub/sub ping queue */
  private async queue() {
    //RabbitMQ currently down
    const start = performance.now();
    const pubSub = null;
    const end = performance.now();

    if (!pubSub) {
      return {
        service: 'RabbitMQ',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'RabbitMQ',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**LiveApps Discord - API call */
  private async liveAppsDiscordAPI(guildId: string) {
    const start = performance.now();
    const getGuild = await this.discordClient.guild.fetch(guildId, {
      ignoreCache: true,
      expiry: 3600,
    });
    const end = performance.now();

    if (!getGuild) {
      return {
        service: 'LiveApps Discord (Cache Miss)',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'LiveApps Discord (Cache Miss)',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**LiveApps Discord - Fetch Cache */
  private async liveAppsDiscordCache(guildId: string) {
    const start = performance.now();
    const getGuild = await this.discordClient.guild.fetch(guildId, {
      expiry: 3600,
    });
    const end = performance.now();

    if (!getGuild) {
      return {
        service: 'LiveApps Discord (Cache Hit)',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'LiveApps Discord (Cache Hit)',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }

  /**REST - kitty chan API */
  private async rest() {
    const start = performance.now();
    const rest = await this.axiosService.axiosInstance({
      method: 'get',
      url: this.kittyChanAPI,
    });
    const end = performance.now();

    if (!rest) {
      return {
        service: 'REST Service',
        isAvailable: false,
        latency: null,
      } as ServiceStats;
    }

    return {
      service: 'REST Service',
      isAvailable: true,
      latency: Number((end - start).toFixed(2)),
    } as ServiceStats;
  }
}
