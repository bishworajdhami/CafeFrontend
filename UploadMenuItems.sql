-- ========================================================
-- UPLOAD MENU ITEMS & CATEGORIES (PRESERVING IDENTITIES)
-- ========================================================
-- This script uploads all categories and menu items from backup,
-- preserving original database IDs to maintain operational links.

SET NOCOUNT ON;

-- 1. UPLOAD MENU CATEGORIES
PRINT 'Uploading Menu Categories...';
SET IDENTITY_INSERT [dbo].[Categories] ON;

INSERT INTO [dbo].[Categories] ([Id], [Name], [CreatedAt])
VALUES
(1, N'Burger', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2)),
(3, N'Momo', CAST(N'2025-11-22T15:00:24.5500000' AS DateTime2)),
(4, N'Pizza', CAST(N'2025-11-22T16:26:45.7343556' AS DateTime2)),
(5, N'Tea', CAST(N'2025-11-23T09:53:36.2779259' AS DateTime2)),
(6, N'Coffee', CAST(N'2026-01-04T08:32:23.0775272' AS DateTime2));

SET IDENTITY_INSERT [dbo].[Categories] OFF;
GO

-- 2. UPLOAD MENU ITEMS
PRINT 'Uploading Menu Items...';
SET IDENTITY_INSERT [dbo].[MenuItems] ON;

INSERT INTO [dbo].[MenuItems] ([Id], [Name], [Price], [IsAvailable], [Category], [IsVatExempt], [IsDeleted])
VALUES
(30, N'Milk Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0),
(31, N'Lemon Tea', CAST(30.00 AS Decimal(18, 2)), 1, N'Tea', 0, 0),
(32, N'Chicken Burger', CAST(300.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(33, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1),
(34, N'Chicken Pizza', CAST(500.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0),
(35, N'Veg Pizza', CAST(400.00 AS Decimal(18, 2)), 1, N'Pizza', 0, 0),
(36, N'Doppio', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(37, N'Americano', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(38, N'Lun', CAST(150.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(39, N'Latte', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(40, N'Cappuccinno', CAST(220.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(41, N'Flat White', CAST(200.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(42, N'Macchiato', CAST(180.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(43, N'Mocha', CAST(250.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(44, N'Cortado', CAST(170.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(45, N'Espresso', CAST(120.00 AS Decimal(18, 2)), 1, N'Coffee', 0, 0),
(48, N'Veg Burger', CAST(200.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(49, N'Buff Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(50, N'Ham Burger', CAST(220.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(51, N'Paneer Burger', CAST(280.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(52, N'Massive Burger', CAST(1000.00 AS Decimal(18, 2)), 1, N'Burger', 0, 0),
(53, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 0, N'Momo', 0, 1),
(54, N'Chicken Momo', CAST(150.00 AS Decimal(18, 2)), 1, N'Momo', 0, 0);

SET IDENTITY_INSERT [dbo].[MenuItems] OFF;
GO
PRINT 'Menu Upload Completed Successfully!';