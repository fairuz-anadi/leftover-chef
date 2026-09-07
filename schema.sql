-- Create database
CREATE DATABASE cse3100_test;
GO

USE cse3100_test;
GO

-- Create login and user
CREATE LOGIN admin WITH PASSWORD = 'StrongPassword123!';
CREATE USER admin FOR LOGIN admin;
GO

-- Create tables
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100),
    email NVARCHAR(100),
    password NVARCHAR(100)
);
GO

CREATE TABLE posts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_posts_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Insert sample data
INSERT INTO users (name, email, password)
VALUES ('Alice', 'alice@example.com', 'password123');
GO

INSERT INTO posts (user_id, title, content)
VALUES (1, 'My First Post', 'This is the content of my first post.');
GO