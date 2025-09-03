const Store = require("electron-store"); const store = new Store(); console.log("配置文件路径:", store.path); console.log("当前配置:", store.get("config"));
