import { EconomySystem } from '../../lib/economy';
const economy = new EconomySystem();

const currencyName = 'Pokèdollars';

export const commands: Chat.ChatCommands = {
	balance: async function (target, room, user) {
    this.runBroadcast(); // Allows broadcasting

    const targetUser = target ? toID(target) : user.id; // Ensures we use userid

    const balance = await economy.getBalance(targetUser);
    this.sendReplyBox(`${targetUser} has ${balance} ${${currencyName}Name}.`);
},

	givemoney: async function (target, room, user) {
    if (!user.can('declare')) return this.errorReply("Access denied.");

    const [targetUserRaw, amountStr] = target.split(',').map(p => p.trim());
    const targetUserID = toID(targetUserRaw); // Convert to userid
    const amount = parseInt(amountStr);

    if (!targetUserID || isNaN(amount) || amount <= 0) {
        return this.errorReply("Invalid usage. Example: /givemoney username, amount");
    }

    await economy.addCurrency(targetUserID, amount);
    this.addGlobalModAction(`${user.name} gave ${amount} ${currencyName} to ${targetUserID}.`);

    // Notify sender
    this.sendReply(`You have successfully given ${amount} ${currencyName} to ${targetUserID}.`);

    // Notify target user if they are online
    const targetUserObj = Users.get(targetUserID);
    if (targetUserObj) {
        targetUserObj.send(`|pm|${user.name}|${targetUserObj.name}|You have received ${amount} ${currencyName} from ${user.name}!`);
    }
},

	takemoney: async function (target, room, user) {
    if (!user.can('declare')) return this.errorReply("Access denied.");

    const [targetUserRaw, amountStr] = target.split(',').map(p => p.trim());
    const targetUserID = toID(targetUserRaw); // Convert to userid
    const amount = parseInt(amountStr);

    if (!targetUserID || isNaN(amount) || amount <= 0) {
        return this.errorReply("Invalid usage. Example: /takemoney username, amount");
    }

    const balance = await economy.getBalance(targetUserID);
    if (balance < amount) return this.errorReply("User does not have enough ${currencyName}.");

    await economy.removeCurrency(targetUserID, amount);
    this.addGlobalModAction(`${user.name} took ${amount} ${currencyName} from ${targetUserID}.`);

    // Notify sender
    this.sendReply(`You have successfully taken ${amount} ${currencyName} from ${targetUserID}.`);

    // Notify target user if they are online
    const targetUserObj = Users.get(targetUserID);
    if (targetUserObj) {
        targetUserObj.send(`|pm|${user.name}|${targetUserObj.name}|${user.name} has taken ${amount} ${currencyName} from you.`);
    }
},

	transfermoney: async function (target, room, user) {
    const [targetUserRaw, amountStr] = target.split(',').map(p => p.trim());
    const targetUserID = toID(targetUserRaw); // Convert to userid
    const senderID = user.id; // Use user.id (already a userid)
    const amount = parseInt(amountStr);

    if (!targetUserID || isNaN(amount) || amount <= 0) {
        return this.errorReply("Invalid usage. Example: /transfermoney username, amount");
    }

    if (senderID === targetUserID) return this.errorReply("You cannot transfer money to yourself.");
    if (await economy.getBalance(senderID) < amount) return this.errorReply("You do not have enough ${currencyName}.");

    await economy.transferCurrency(senderID, targetUserID, amount);
    this.addGlobalModAction(`${user.name} transferred ${amount} ${currencyName} to ${targetUserID}.`);

    // Notify sender
    this.sendReply(`You have successfully transferred ${amount} ${currencyName} to ${targetUserID}.`);

    // Notify recipient if online
    const targetUserObj = Users.get(targetUserID);
    if (targetUserObj) {
        targetUserObj.send(`|pm|${user.name}|${targetUserObj.name}|You have received ${amount} ${currencyName} from ${user.name}!`);
    }
},

	richestuser: async function (target, room, user) {
    if (target && toID(target) === "all") {
        // Show top 100 but do not broadcast
        const topUsers = await economy.getRichestUsers(100);
        if (!topUsers.length) return this.sendReplyBox("No users found in the economy system.");

        let msg = `<strong>Top 100 Richest Users:</strong><br>`;
        for (let i = 0; i < topUsers.length; i++) {
            const username = Users.get(topUsers[i].user)?.name || topUsers[i].user;
            msg += `${i + 1}. <strong>${username}</strong>: ${topUsers[i].balance} ${currencyName}<br>`;
        }

        return this.sendReplyBox(
            `<div style="max-height: 300px; overflow: auto; padding: 5px; border: 1px solid #444; background: #222; color: white;">${msg}</div>`
        );
    }

    this.runBroadcast(); // Allow broadcasting

    const topUsers = await economy.getRichestUsers(20); // Get top 20 users
    if (!topUsers.length) return this.sendReplyBox("No users found in the economy system.");

    let msg = `<strong>Top 20 Richest Users:</strong><br>`;
    for (let i = 0; i < topUsers.length; i++) {
        const username = Users.get(topUsers[i].user)?.name || topUsers[i].user;
        msg += `${i + 1}. <strong>${username}</strong>: ${topUsers[i].balance} ${currencyName}<br>`;
    }

    return this.sendReplyBox(
        `<div style="max-height: 300px; overflow: auto; padding: 5px; border: 1px solid #444; background: #222; color: white;">${msg}</div>`
    );
},

	reset: async function (target, room, user) {
    if (!user.can('declare')) return this.errorReply("Access denied.");

    await economy.resetAll();
    this.addGlobalModAction(`${user.name} has reset all user balances.`);

    // Notify all online users
    room.add(`|html|<div style="border: 1px solid #444; background: #222; color: white; padding: 5px;">All user balances have been reset by ${user.name}.</div>`);
},

deleteuser: async function (target, room, user) {
    if (!user.can('declare')) return this.errorReply("Access denied.");
    
    const targetUserID = toID(target);
    if (!targetUserID) return this.errorReply("Please specify a valid user to delete.");

    await economy.deleteUser(targetUserID);
    this.addGlobalModAction(`${user.name} deleted ${targetUserID} from the economy system.`);

    // Notify sender
    this.sendReply(`You have successfully deleted ${targetUserID} from the economy system.`);

    // Notify target user if online
    const targetUserObj = Users.get(targetUserID);
    if (targetUserObj) {
        targetUserObj.send(`|pm|${user.name}|${targetUserObj.name}|Your economy data has been deleted by ${user.name}.`);
    }
},
	
    economyhelp: function (target, room, user) {
        this.runBroadcast();
		 this.sendReplyBox(`<div style="max-height:300px; overflow:auto; padding:5px; border:1px solid #444; background:#222; color:white;"><strong><center>Economy Commands:</center></strong><br><strong>/balance [username]</strong> - Shows your or another user's balance.<br><strong>/givemoney [username], [amount]</strong> - Give a user ${currencyName}. (Admin only)<br><strong>/takemoney [username], [amount]</strong> - Remove ${currencyName} from a user. (Admin only)<br><strong>/transfermoney [username], [amount]</strong> - Transfer ${currencyName} to another user.<br><strong>/richestuser</strong> - Show the top 20 richest users.<br><strong>/richestuser all</strong> - Show the top 100 richest users (non-broadcast).<br><strong>/reset</strong> - Reset all balances. (Admin only)<br><strong>/deleteuser [username]</strong> - Delete a user's economy data. (Admin only)<br></div>`);
    },
};
