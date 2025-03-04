# 🏦 Economy System for Pokémon Showdown  

A **lightweight and efficient economy system** designed for Pokémon Showdown Servers. Supports **JSON storage** and **MongoDB**, allowing users to manage virtual currency with **balances, transfers, leaderboards, and admin controls**.

---

## ✨ Features
✅ **User Balance Management** – Check and manage virtual currency easily  
✅ **Currency Transactions** – Earn, transfer, or spend currency  
✅ **Richest Users Leaderboard** – View the wealthiest users  
✅ **Admin Commands** – Control the economy with powerful tools  
✅ **MongoDB Support** – Scale efficiently with a database backend  

---

## 🚀 Installation

### 1️⃣ Clone the repository  
```sh
git clone https://github.com/yourusername/economy-system.git
cd economy-system
```

### 2️⃣ Move the necessary files to your Pokémon Showdown repository

- Move `economy.ts` to:  
  ```sh
  /lib/economy.ts
  ```
- Move `economy-commands.ts` to:  
  ```sh
  /server/chat-plugins/economy-commands.ts
  ```

### 3️⃣ Configure the Economy System  

- **JSON Mode (default):** Stores economy data in `databases/economy.json`.  
- **MongoDB Mode:**  
  - Set `useMongoDB = true` in `economy.ts`.  
  - Provide your **MongoDB connection URL** in `mongoUrl`.

### 4️⃣ Restart Pokémon Showdown Server  
```sh
npm run start
```

---

## 🔧 Usage Guide  

### 🏦 Checking Your Balance  
```sh
/balance [username]
```
> 📌 Example: `/balance Pikachu` → *Shows Pikachu’s balance.*

### 💰 Earning & Spending Currency  
```sh
/givemoney [username], [amount]    # Admins only
/takemoney [username], [amount]    # Admins only
/transfermoney [username], [amount]
```
> 📌 Example: `/transfermoney Bulbasaur, 100` → *Transfers 100 currency to Bulbasaur.*

### 📈 Checking Richest Users  
```sh
/richestuser        # Top 20 users
/richestuser all    # Top 100 users (non-broadcast)
```

### 🔥 Admin Economy Controls  
```sh
/reset             # Resets all user balances (Admin only)
/deleteuser [username] # Deletes a user from the economy system (Admin only)
```

---

## 📖 API Reference  

The `EconomySystem` class provides essential economy functions:

| Method | Description |
|--------|-------------|
| `getBalance(userid: string): Promise<number>` | Get a user's balance. |
| `addCurrency(userid: string, amount: number): Promise<void>` | Add currency to a user's balance. |
| `removeCurrency(userid: string, amount: number): Promise<void>` | Remove currency from a user's balance. |
| `transferCurrency(fromUser: string, toUser: string, amount: number): Promise<void>` | Transfer currency between users. |
| `getRichestUsers(limit: number): Promise<{ user: string; balance: number }[]>` | Get the richest users. |
| `resetAll(): Promise<void>` | Reset all user balances. |
| `deleteUser(userid: string): Promise<void>` | Delete a user from the economy system. |

## 🙌 Credits  

Developed by Clark Jones @Prince Sky
Contributions and feedback are always welcome!  

---
