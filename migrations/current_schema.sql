-- Only for reference

CREATE TABLE IF NOT EXISTS users(
    id VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(512) NOT NULL,
    githubToken VARCHAR(512) NOT NULL DEFAULT "",

    PRIMARY KEY(id));

CREATE TABLE IF NOT EXISTS projects(
    id VARCHAR(128) NOT NULL UNIQUE,
    userId VARCHAR(128) NOT NULL,
    name VARCHAR(512) NOT NULL,                 -- project identifier ie. "username/projectname"
    origin VARCHAR(512) NOT NULL DEFAULT "",    -- origin for GitLab host
    enabled BOOLEAN DEFAULT true,
    lastSuccessfulSyncAt BIGINT DEFAULT 0,
    type VARCHAR(32) NOT NULL DEFAULT "github",

    FOREIGN KEY(userId) REFERENCES users(id),
    PRIMARY KEY(id));

CREATE TABLE IF NOT EXISTS releases(
    id VARCHAR(128) NOT NULL UNIQUE,
    projectId VARCHAR(128) NOT NULL,
    version VARCHAR(512) NOT NULL,
    notified BOOLEAN DEFAULT false,
    createdAt BIGINT NOT NULL,

    FOREIGN KEY(projectId) REFERENCES projects(id),
    PRIMARY KEY(id));
