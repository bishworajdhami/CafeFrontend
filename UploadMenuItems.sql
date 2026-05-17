-- ========================================================
-- UPLOAD & SYNCHRONIZE MENU ITEMS & CATEGORIES (UPSERT)
-- ========================================================
-- This script uploads all categories and menu items from backup.
-- To ensure categories and details are fully up-to-date, it inserts
-- new records and UPDATES existing records if their IDs are already present.

SET NOCOUNT ON;

-- 1. UPLOAD/UPDATE MENU CATEGORIES
PRINT 'Synchronizing Menu Categories...';
SET IDENTITY_INSERT [dbo].[Categories] ON;

IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 1)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (1, N'Burger', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2))
ELSE
    UPDATE [dbo].[Categories] SET [Name] = N'Burger', [CreatedAt] = CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2) WHERE [Id] = 1;
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 3)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (3, N'Momo', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2))
ELSE
    UPDATE [dbo].[Categories] SET [Name] = N'Momo', [CreatedAt] = CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2) WHERE [Id] = 3;
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 4)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (4, N'Pizza', CAST(N'2025-11-22T16:26:45.7343556' AS DateTime2))
ELSE
    UPDATE [dbo].[Categories] SET [Name] = N'Pizza', [CreatedAt] = CAST(N'2025-11-22T16:26:45.7343556' AS DateTime2) WHERE [Id] = 4;
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 5)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (5, N'Tea', CAST(N'2025-11-23T09:53:36.2779259' AS DateTime2))
ELSE
    UPDATE [dbo].[Categories] SET [Name] = N'Tea', [CreatedAt] = CAST(N'2025-11-23T09:53:36.2779259' AS DateTime2) WHERE [Id] = 5;
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 6)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (6, N'Coffee', CAST(N'2026-01-04T08:32:23.0775272' AS DateTime2))
ELSE
    UPDATE [dbo].[Categories] SET [Name] = N'Coffee', [CreatedAt] = CAST(N'2026-01-04T08:32:23.0775272' AS DateTime2) WHERE [Id] = 6;

SET IDENTITY_INSERT [dbo].[Categories] OFF;
GO

-- 2. UPLOAD/UPDATE MENU ITEMS
PRINT 'Synchronizing Menu Items...';
SET IDENTITY_INSERT [dbo].[MenuItems] ON;

IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 30)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (30, N'Milk Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Milk Tea', [Price] = CAST(30.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 30;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 31)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (31, N'Lemon Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Lemon Tea', [Price] = CAST(30.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 31;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 32)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (32, N'Chicken Burger', CAST(300.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Chicken Burger', [Price] = CAST(300.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 32;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 33)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (33, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Chicken Momo', [Price] = CAST(150.00 AS Decimal(18, 2)), [IsAvailable] = 0, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 1 WHERE [Id] = 33;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 34)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (34, N'Chicken Pizza', CAST(500.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Chicken Pizza', [Price] = CAST(500.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 34;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 35)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (35, N'Veg Pizza', CAST(400.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Veg Pizza', [Price] = CAST(400.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 35;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 36)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (36, N'Doppio', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Doppio', [Price] = CAST(200.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 36;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 37)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (37, N'Americano', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Americano', [Price] = CAST(180.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 37;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 38)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (38, N'Lun', CAST(150.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Lun', [Price] = CAST(150.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 38;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 39)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (39, N'Latte', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Latte', [Price] = CAST(200.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 39;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 40)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (40, N'Cappuccinno', CAST(220.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Cappuccinno', [Price] = CAST(220.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 40;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 41)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (41, N'Flat White', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Flat White', [Price] = CAST(200.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 41;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 42)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (42, N'Macchiato', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Macchiato', [Price] = CAST(180.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 42;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 43)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (43, N'Mocha', CAST(250.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Mocha', [Price] = CAST(250.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 43;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 44)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (44, N'Cortado', CAST(170.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Cortado', [Price] = CAST(170.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 44;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 45)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (45, N'Espresso', CAST(120.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Espresso', [Price] = CAST(120.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 45;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 48)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (48, N'Veg Burger', CAST(200.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Veg Burger', [Price] = CAST(200.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 48;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 49)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (49, N'Buff Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Buff Burger', [Price] = CAST(280.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 49;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 50)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (50, N'Ham Burger', CAST(220.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Ham Burger', [Price] = CAST(220.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 50;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 51)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (51, N'Paneer Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Paneer Burger', [Price] = CAST(280.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 51;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 52)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (52, N'Massive Burger', CAST(1000.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Massive Burger', [Price] = CAST(1000.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 52;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 53)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (53, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Chicken Momo', [Price] = CAST(150.00 AS Decimal(18, 2)), [IsAvailable] = 0, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 1 WHERE [Id] = 53;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 54)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (54, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Chicken Momo', [Price] = CAST(150.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 54;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 55)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (55, N'Cold Brew', CAST(190.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Cold Brew', [Price] = CAST(190.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 55;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 56)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (56, N'Iced Latte', CAST(220.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Iced Latte', [Price] = CAST(220.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 56;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 57)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (57, N'Caramel Macchiato', CAST(280.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Caramel Macchiato', [Price] = CAST(280.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 57;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 58)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (58, N'Irish Coffee', CAST(320.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Irish Coffee', [Price] = CAST(320.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 58;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 59)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (59, N'Affogato', CAST(250.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Affogato', [Price] = CAST(250.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Coffee', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 59;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 60)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (60, N'Green Tea', CAST(60.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Green Tea', [Price] = CAST(60.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 60;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 61)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (61, N'Black Tea', CAST(40.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Black Tea', [Price] = CAST(40.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 61;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 62)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (62, N'Ginger Honey Tea', CAST(90.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Ginger Honey Tea', [Price] = CAST(90.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 62;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 63)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (63, N'Matcha Latte', CAST(260.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Matcha Latte', [Price] = CAST(260.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 63;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 64)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (64, N'Masala Chai', CAST(80.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Masala Chai', [Price] = CAST(80.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Tea', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 64;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 65)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (65, N'Double Cheese Burger', CAST(380.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Double Cheese Burger', [Price] = CAST(380.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 65;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 66)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (66, N'Crispy Chicken Burger', CAST(320.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Crispy Chicken Burger', [Price] = CAST(320.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 66;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 67)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (67, N'Bacon Swiss Burger', CAST(420.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Bacon Swiss Burger', [Price] = CAST(420.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 67;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 68)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (68, N'BBQ Pulled Pork Burger', CAST(450.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'BBQ Pulled Pork Burger', [Price] = CAST(450.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Burger', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 68;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 69)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (69, N'Veg Momo', CAST(120.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Veg Momo', [Price] = CAST(120.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 69;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 70)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (70, N'Buff Momo', CAST(140.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Buff Momo', [Price] = CAST(140.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 70;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 71)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (71, N'Cheese Momo', CAST(180.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Cheese Momo', [Price] = CAST(180.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 71;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 72)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (72, N'Jhol Momo', CAST(170.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Jhol Momo', [Price] = CAST(170.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 72;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 73)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (73, N'C-Momo', CAST(190.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'C-Momo', [Price] = CAST(190.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 73;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 74)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (74, N'Fried Momo', CAST(160.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Fried Momo', [Price] = CAST(160.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Momo', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 74;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 75)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (75, N'Margherita Pizza', CAST(380.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Margherita Pizza', [Price] = CAST(380.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 75;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 76)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (76, N'Pepperoni Pizza', CAST(480.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Pepperoni Pizza', [Price] = CAST(480.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 76;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 77)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (77, N'Mushroom & Olive Pizza', CAST(420.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Mushroom & Olive Pizza', [Price] = CAST(420.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 77;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 78)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (78, N'Hawaiian Pizza', CAST(460.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'Hawaiian Pizza', [Price] = CAST(460.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 78;
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 79)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (79, N'BBQ Chicken Pizza', CAST(520.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0)
ELSE
    UPDATE [dbo].[MenuItems] SET [Name] = N'BBQ Chicken Pizza', [Price] = CAST(520.00 AS Decimal(18, 2)), [IsAvailable] = 1, [Category] = N'Pizza', [IsVatExempt] = 0, [IsDeleted] = 0 WHERE [Id] = 79;

SET IDENTITY_INSERT [dbo].[MenuItems] OFF;
GO
PRINT 'Menu Synchronization Completed Successfully!';