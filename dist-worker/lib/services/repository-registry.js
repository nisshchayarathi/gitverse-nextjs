"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryRegistry = exports.RepositoryRegistry = void 0;
class RepositoryRegistry {
    registry = new Map();
    lastSynced = new Map();
    registerRepositories(orgName, repositories) {
        repositories.forEach(repo => {
            this.registry.set(repo.fullName, repo);
            this.registry.set(repo.id.toString(), repo);
        });
        this.lastSynced.set(orgName, new Date());
    }
    getRepository(identifier) {
        return this.registry.get(identifier.toString());
    }
    getAllRepositoriesForOrg(orgName) {
        return Array.from(this.registry.values()).filter(repo => repo.owner.toLowerCase() === orgName.toLowerCase());
    }
    isRegistryStale(orgName, ttlMs = 3600000) {
        const lastSync = this.lastSynced.get(orgName);
        if (!lastSync)
            return true;
        return (new Date().getTime() - lastSync.getTime()) > ttlMs;
    }
}
exports.RepositoryRegistry = RepositoryRegistry;
exports.repositoryRegistry = new RepositoryRegistry();
