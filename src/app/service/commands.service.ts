import { inject, injectable } from 'inversify';
import { IGuild } from '../interface/shared.interface';
import 'dotenv/config';
import { TYPES } from '../../core/inversify.types';
import { ActionService } from './shared/action.service';
import { VALORANT_RANK } from '../data/valorant_ranks';
import { VALORANT_RANK_ROLES } from '../data/server_roles';
import { ResponseService } from './shared/response.service';
import { REPLY } from '../enum/reply';
import { RANK_MESSAGES } from '../content/rank.content';

@injectable()
export class CommandService{
	kitty_chan_id = process.env.KITTY_CHAN_ID;
	constructor(
        @inject(TYPES.ActionService) private readonly actionService: ActionService,
        @inject(TYPES.ResponseService) private readonly responseService: ResponseService,
	) { }
    
	///Validate and Filter Command
	async validateCommand(guild: IGuild) {
		const message = (guild.messageContent).trim().toLowerCase();
		const messageChunk = message.split(' ');
		console.log(messageChunk);

		///Check if kitty tagged
		if (messageChunk[0] !== `<@${this.kitty_chan_id}>`) return;
		console.log('Tagged');
		///Check Rank Set Command
		if (messageChunk[1] === 'rank') {
			await this.set_rank(guild, messageChunk[2]);
			return;
		}
	}

	async set_rank(guild: IGuild, rank: string) {
		if (!rank) {
            
			await this.responseService.respond({
				type: REPLY.replyMessage,
				guild,
				body: {
					content: RANK_MESSAGES.invalid_rank,
					message_reference: {
						message_id: guild.messageId
					}
				}
			});
            
			return;
		}
		///Validate & Assign Roles
		let isRoleValid = false;
		for (let index = 0; index < VALORANT_RANK.length; index++) {
			const element = VALORANT_RANK[index];
			if (element.toLowerCase() === rank.toLowerCase()) {
				///Call API
				await this.actionService.call({
					type: 'setRole',
					guild,
					body: {
						roleId: VALORANT_RANK_ROLES[element]
					}
				});
				isRoleValid = true;
				return;
			}
		}

		console.log(isRoleValid);
		if (!isRoleValid) {
			await this.responseService.respond({
				type: REPLY.replyMessage,
				guild,
				body: {
					content: RANK_MESSAGES.invalid_rank,
					message_reference: {
						message_id: guild.messageId
					}
				}
			});
		}

        
	}
}