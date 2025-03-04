import { FS } from './fs';
import { MongoClient, Collection } from 'mongodb';

const economyConfig = {
    useMongoDB: false, // Set to false to use FS (JSON) mode
    mongoUrl: "mongodb://localhost:27017", // Change this if using a remote database
    databaseName: "pokemonshowdown",
    jsonFilePath: "databases/economy.json", // Used only if MongoDB is disabled
};

export class EconomySystem {
    private data: Record<string, number> = {}; // Ensure data is always initialized
    private filePath: string;
    private balancesCollection: Collection | null = null;
    private mongoClient: MongoClient | null = null;

    constructor() {
        this.filePath = economyConfig.jsonFilePath;

        if (economyConfig.useMongoDB) {
            this.connectMongoDB().catch(error => console.error("MongoDB connection error:", error));
        } else {
            this.load();
        }

        // Ensure MongoDB disconnects when the process exits
        process.on("exit", () => this.disconnectMongoDB());
        process.on("SIGINT", () => this.disconnectMongoDB());
    }

    private async connectMongoDB(): Promise<void> {
        if (this.mongoClient) return; // Prevent duplicate connections

        try {
            this.mongoClient = new MongoClient(economyConfig.mongoUrl);
            await this.mongoClient.connect();
            this.balancesCollection = this.mongoClient.db(economyConfig.databaseName).collection("economy");
            console.log("Connected to MongoDB.");
        } catch (error) {
            console.error("Failed to connect to MongoDB:", error);
            this.mongoClient = null;
            this.balancesCollection = null;
        }
    }

    private disconnectMongoDB(): void {
        if (this.mongoClient) {
            this.mongoClient.close().then(() => console.log("MongoDB connection closed."));
            this.mongoClient = null;
            this.balancesCollection = null;
        }
    }

	private load(): void {
    if (!FS(this.filePath).existsSync()) {
        this.data = {}; // Ensure `this.data` is always initialized
        return;
    }

    try {
        const fileContents = FS(this.filePath).readSync();
        this.data = JSON.parse(fileContents) || {}; // Ensure data is always an object
    } catch (error) {
        console.error("Failed to load economy data, resetting to default:", error);
        this.data = {}; // Reset to prevent crashes due to corrupted JSON
    }
}

private async save(): Promise<void> {
    if (!this.balancesCollection) {
        try {
            await FS(this.filePath).writeUpdate(() => JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error("Failed to save economy data:", error);
            throw new Error("Could not save data.");
        }
    }
}

	async getBalance(userid: string): Promise<number> {
    userid = toID(userid); // Ensure proper userid formatting

    if (this.balancesCollection) {
        try {
            const user = await this.balancesCollection.findOne<{ balance: number }>(
                { userid },
                { projection: { balance: 1 } } // Only fetch the balance field
            );
            return user?.balance ?? 0;
        } catch (error) {
            console.error(`Database error while fetching balance for ${userid}:`, error);
            throw new Error("Failed to retrieve balance.");
        }
    }

    return this.data?.[userid] ?? 0; // Ensure `this.data` exists and return 0 if not found
	}

	async addCurrency(userid: string, amount: number): Promise<void> {
    userid = toID(userid); // Ensure proper userid formatting
    if (amount <= 0) throw new Error("Amount must be greater than zero.");

    if (this.balancesCollection) {
        try {
            const result = await this.balancesCollection.findOneAndUpdate(
                { userid },
                { $inc: { balance: amount } },
                { upsert: true, returnDocument: "after" }
            );

            if (!result.value) {
                throw new Error(`Failed to update balance for ${userid}`);
            }
        } catch (error) {
            console.error(`Database error while updating balance for ${userid}:`, error);
            throw new Error("Database update failed.");
        }
    } else {
        if (!this.filePath) throw new Error("filePath is undefined in FS mode.");
        if (!this.data) this.data = {}; // Ensure `this.data` exists
        this.data[userid] = (this.data[userid] || 0) + amount;
        await this.save();
    }
	}
	
	async removeCurrency(userid: string, amount: number): Promise<void> {
    userid = toID(userid); // Ensure proper userid formatting
    if (amount <= 0) throw new Error("Amount must be greater than zero.");

    const balance = await this.getBalance(userid);
    if (balance < amount) throw new Error("Insufficient funds.");

    if (this.balancesCollection) {
        try {
            const result = await this.balancesCollection.findOneAndUpdate(
                { userid, balance: { $gte: amount } }, // Ensure sufficient balance before updating
                { $inc: { balance: -amount } },
                { returnDocument: "after" }
            );

            if (!result.value) {
                throw new Error(`Failed to remove currency: insufficient funds for ${userid}`);
            }
        } catch (error) {
            console.error(`Database error while removing currency for ${userid}:`, error);
            throw new Error("Database update failed.");
        }
    } else {
        if (!(userid in this.data)) throw new Error("User does not exist.");
        this.data[userid] = Math.max(0, balance - amount);
        await this.save();
    }
	}

	async transferCurrency(fromUser: string, toUser: string, amount: number): Promise<void> {
    fromUser = toID(fromUser);
    toUser = toID(toUser);
    
    if (amount <= 0) throw new Error("Amount must be greater than zero.");
    if (fromUser === toUser) throw new Error("Cannot transfer currency to yourself.");

    const balance = await this.getBalance(fromUser);
    if (balance < amount) throw new Error("Insufficient funds.");

    if (this.balancesCollection) {
        const session = this.balancesCollection.client.startSession();
        try {
            session.startTransaction();

            // Ensure sender has enough balance and deduct
            const fromUpdate = await this.balancesCollection.findOneAndUpdate(
                { userid: fromUser, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { session, returnDocument: "after" }
            );
            if (!fromUpdate.value) throw new Error("Transaction failed: insufficient funds.");

            // Add balance to recipient
            const toUpdate = await this.balancesCollection.updateOne(
                { userid: toUser },
                { $inc: { balance: amount } },
                { upsert: true, session }
            );
            if (toUpdate.modifiedCount === 0 && !toUpdate.upsertedCount) {
                throw new Error("Transaction failed: unable to update recipient.");
            }

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            console.error(`Failed to transfer currency from ${fromUser} to ${toUser}:`, error);
            throw new Error("Transaction failed.");
        } finally {
            session.endSession(); // Ensure session always ends
        }
    } else {
        await this.removeCurrency(fromUser, amount);
        await this.addCurrency(toUser, amount);
    }
	}

	async resetAll(): Promise<void> {
    if (this.balancesCollection) {
        try {
            const collections = await this.balancesCollection.db.listCollections().toArray();
            const collectionExists = collections.some(col => col.name === this.balancesCollection.collectionName);

            if (collectionExists) {
                await this.balancesCollection.drop();
            }
        } catch (error) {
            console.error("Failed to reset balances:", error);
            throw new Error("Database reset failed.");
        }
    } else {
        this.data = {};
        await this.save();
    }
}

async deleteUser(userid: string): Promise<void> {
    userid = toID(userid); // Ensure proper userid formatting

    if (this.balancesCollection) {
        try {
            const result = await this.balancesCollection.deleteOne({ userid });
            if (result.deletedCount === 0) {
                console.warn(`User ${userid} not found.`);
            }
        } catch (error) {
            console.error(`Failed to delete user ${userid}:`, error);
            throw new Error("Database deletion failed.");
        }
    } else {
        if (this.data[userid]) {
            delete this.data[userid];
            await this.save();
        }
    }
}

async getRichestUsers(limit: number = 20): Promise<{ user: string; balance: number }[]> {
    if (this.balancesCollection) {
        try {
            // Ensure an index on balance for efficient sorting
            await this.balancesCollection.createIndex({ balance: -1 });

            const users = await this.balancesCollection.find({}, { projection: { _id: 0, userid: 1, balance: 1 } })
                .sort({ balance: -1 })
                .limit(limit)
                .toArray();

            return users.map(user => ({ user: user.userid, balance: Number(user.balance) }));
        } catch (error) {
            console.error("Failed to fetch richest users:", error);
            throw new Error("Database query failed.");
        }
    } else {
        return Object.entries(this.data)
            .map(([user, balance]) => ({ user, balance: Number(balance) }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, limit);
    }
}
}
