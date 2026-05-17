-- ========================================================
-- UPLOAD MENU ITEMS & CATEGORIES (PRESERVING IDENTITIES)
-- ========================================================
-- This script uploads all categories and menu items from backup,
-- preserving original database IDs to maintain operational links.
-- It safely skips already existing IDs to prevent PK violations.

SET NOCOUNT ON;

-- 1. UPLOAD MENU CATEGORIES
PRINT 'Uploading Menu Categories...';
SET IDENTITY_INSERT [dbo].[Categories] ON;

IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 1)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (1, N'Burger', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2));
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 3)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (3, N'Momo', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2));
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 4)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (4, N'Pizza', CAST(N'2025-11-22T16:26:45.7343556' AS DateTime2));
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 5)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (5, N'Tea', CAST(N'2025-11-23T09:53:36.2779259' AS DateTime2));
IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Id] = 6)
    INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt]) VALUES (6, N'Coffee', CAST(N'2026-01-04T08:32:23.0775272' AS DateTime2));

SET IDENTITY_INSERT [dbo].[Categories] OFF;
GO

-- 2. UPLOAD MENU ITEMS
PRINT 'Uploading Menu Items...';
SET IDENTITY_INSERT [dbo].[MenuItems] ON;

IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 30)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (30, N'Milk Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 31)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (31, N'Lemon Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 32)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (32, N'Chicken Burger', CAST(300.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 33)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (33, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 34)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (34, N'Chicken Pizza', CAST(500.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 35)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (35, N'Veg Pizza', CAST(400.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 36)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (36, N'Doppio', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 37)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (37, N'Americano', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 38)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (38, N'Lun', CAST(150.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 39)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (39, N'Latte', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 40)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (40, N'Cappuccinno', CAST(220.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 41)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (41, N'Flat White', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 42)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (42, N'Macchiato', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 43)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (43, N'Mocha', CAST(250.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 44)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (44, N'Cortado', CAST(170.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 45)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (45, N'Espresso', CAST(120.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 48)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (48, N'Veg Burger', CAST(200.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 49)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (49, N'Buff Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 50)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (50, N'Ham Burger', CAST(220.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 51)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (51, N'Paneer Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 52)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (52, N'Massive Burger', CAST(1000.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 53)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (53, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = 54)
    INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
    VALUES (54, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0);

SET IDENTITY_INSERT [dbo].[MenuItems] OFF;
GO
PRINT 'Menu Upload Completed Successfully!';