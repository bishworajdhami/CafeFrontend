-- =============================================
-- MASSIVE PAST DATA GENERATOR (V4 - FIXED)
-- =============================================
-- This script generates random order data, staff, cash, bookings, and stock records.
-- Fix: Removed dummy BookingId to avoid FK constraints with TableBookings.
-- =============================================

SET NOCOUNT ON;

DECLARE @StartDate DATETIME = DATEADD(year, -1, CAST(GETUTCDATE() AS DATE));
DECLARE @EndDate DATETIME = GETUTCDATE();
DECLARE @CurrentDate DATETIME = @StartDate;

-- Settings (Adjust these for more/less data)
DECLARE @MinOrdersPerDay INT = 15;
DECLARE @MaxOrdersPerDay INT = 40;
DECLARE @TaxRate DECIMAL(5,2) = 0.13;

-- =============================================
-- 1. ENSURE BASE CONFIGURATIONS & SEED DATA EXIST
-- =============================================

-- A. ENSURE SETTINGS EXIST
PRINT 'Initializing System Settings...';
IF NOT EXISTS (SELECT 1 FROM [Settings])
BEGIN
    INSERT INTO [Settings] ([Key], [Value], [UpdatedAt])
    VALUES
    ('VatPercentage', '13', GETUTCDATE()),
    ('VatIncluded', 'True', GETUTCDATE()),
    ('ServiceChargePercentage', '0', GETUTCDATE()),
    ('ServiceChargeIncluded', 'False', GETUTCDATE()),
    ('ShowRefundTab', 'True', GETUTCDATE()),
    ('tableBookingCharge', '100', GETUTCDATE()),
    ('tableBookingChargeType', 'per_hour', GETUTCDATE()),
    ('enableManualTableSelection', 'False', GETUTCDATE()),
    ('enableTableBooking', 'True', GETUTCDATE()),
    ('PayFirst', 'False', GETUTCDATE()),
    ('Kitchen_SoundEnabled', 'True', GETUTCDATE()),
    ('Kitchen_AutoAcceptOrders', 'True', GETUTCDATE()),
    ('Kitchen_PriorityAlerts', 'True', GETUTCDATE()),
    ('Kitchen_DisplayMode', 'grid', GETUTCDATE()),
    ('Kitchen_PrepTimeWarning', '15', GETUTCDATE()),
    ('Kitchen_MaxActiveOrders', '10', GETUTCDATE()),
    ('CafeName', 'KTM Roast & Brew', GETUTCDATE()),
    ('CafeAddress', 'Kathmandu, Nepal', GETUTCDATE()),
    ('CafePhone', '9812345678', GETUTCDATE()),
    ('CafePan', '123456789', GETUTCDATE()),
    ('CashClosing:AutoSubmitEnabled', 'True', GETUTCDATE()),
    ('CashClosing:AutoSubmitTime', '23:59', GETUTCDATE()),
    ('TableConfiguration', '{"floors":[{"id":1766869580558,"name":"Floor 1","tableCount":15,"seats":4,"customSeats":{"15":8}},{"id":1766869585147,"name":"Floor 2","tableCount":14,"seats":4},{"id":1766869586956,"name":"Floor 3","tableCount":8,"seats":6},{"id":1767515340749,"name":"Floor 4","tableCount":10,"seats":6,"customSeats":{"10":10}},{"id":1778858847005,"name":"Floor 5","tableCount":5,"seats":4}]}', GETUTCDATE());
END

-- B. ENSURE MENU CATEGORIES EXIST
PRINT 'Initializing Menu Categories...';
IF NOT EXISTS (SELECT 1 FROM [Cateries])
BEGIN
    INSERT INTO [Cateries] ([Name], [CreatedAt])
    VALUES
    ('Burger', GETUTCDATE()),
    ('Momo', GETUTCDATE()),
    ('Pizza', GETUTCDATE()),
    ('Tea', GETUTCDATE()),
    ('Coffee', GETUTCDATE());
END

-- C. ENSURE MENU ITEMS EXIST
PRINT 'Initializing Menu Items...';
IF NOT EXISTS (SELECT 1 FROM [MenuItems])
BEGIN
    INSERT INTO [MenuItems] ([Name], [Price], [IsAvailable], [Category], [IsVatExempt], [VatIncluded], [IsDeleted])
    VALUES
    ('Milk Tea', 30.00, 1, 'Tea', 0, 0, 0),
    ('Lemon Tea', 30.00, 1, 'Tea', 0, 0, 0),
    ('Chicken Burger', 300.00, 1, 'Burger', 0, 0, 0),
    ('Chicken Pizza', 500.00, 1, 'Pizza', 0, 0, 0),
    ('Veg Pizza', 400.00, 1, 'Pizza', 0, 0, 0),
    ('Doppio', 200.00, 1, 'Coffee', 0, 0, 0),
    ('Americano', 180.00, 1, 'Coffee', 0, 0, 0),
    ('Lun', 150.00, 1, 'Coffee', 0, 0, 0),
    ('Latte', 200.00, 1, 'Coffee', 0, 0, 0),
    ('Cappuccinno', 220.00, 1, 'Coffee', 0, 0, 0),
    ('Flat White', 200.00, 1, 'Coffee', 0, 0, 0),
    ('Macchiato', 180.00, 1, 'Coffee', 0, 0, 0),
    ('Mocha', 250.00, 1, 'Coffee', 0, 0, 0),
    ('Cortado', 170.00, 1, 'Coffee', 0, 0, 0),
    ('Espresso', 120.00, 1, 'Coffee', 0, 0, 0),
    ('Veg Burger', 200.00, 1, 'Burger', 0, 0, 0),
    ('Buff Burger', 280.00, 1, 'Burger', 0, 0, 0),
    ('Ham Burger', 220.00, 1, 'Burger', 0, 0, 0),
    ('Paneer Burger', 280.00, 1, 'Burger', 0, 0, 0),
    ('Chicken Momo', 150.00, 1, 'Momo', 0, 0, 0);
END

-- D. ENSURE TABLE SEATS EXIST
PRINT 'Initializing Table Seats...';
IF NOT EXISTS (SELECT 1 FROM [TableSeats])
BEGIN
    DECLARE @F INT = 1;
    WHILE @F <= 5
    BEGIN
        DECLARE @FName NVARCHAR(50) = 'Floor ' + CAST(@F AS NVARCHAR);
        DECLARE @MaxTables INT = CASE @F WHEN 1 THEN 15 WHEN 2 THEN 14 WHEN 3 THEN 8 WHEN 4 THEN 10 ELSE 5 END;
        DECLARE @DefaultSeats INT = CASE @F WHEN 3 THEN 6 WHEN 4 THEN 6 ELSE 4 END;
        
        DECLARE @T INT = 1;
        WHILE @T <= @MaxTables
        BEGIN
            DECLARE @TName NVARCHAR(50) = CAST(@T AS NVARCHAR);
            DECLARE @SeatsForTable INT = @DefaultSeats;
            
            IF @F = 1 AND @T = 15 SET @SeatsForTable = 8;
            IF @F = 4 AND @T = 10 SET @SeatsForTable = 10;
            
            DECLARE @S INT = 1;
            WHILE @S <= @SeatsForTable
            BEGIN
                INSERT INTO [TableSeats] ([FloorName], [TableNumber], [SeatNumber], [Status])
                VALUES (@FName, @TName, @S, 'Available');
                SET @S = @S + 1;
            END
            SET @T = @T + 1;
        END
        SET @F = @F + 1;
    END
END

-- =============================================
-- 2. ENSURE STOCK PRODUCTS EXIST
-- =============================================
PRINT 'Initializing Stock Products...';
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM [Products])
BEGIN
    INSERT INTO [Products] ([Name], [Category], [Unit], [MinStockLevel], [ShelfLifeDays], [Price], [DailyUsageRate], [IsArchived], [ReorderDays])
    VALUES 
    ('Coffee Beans (Arabica)', 'Ingredients', 'KG', 5, 180, 1200, 0.5, 0, 3),
    ('Whole Milk', 'Dairy', 'Litre', 10, 7, 95, 2.0, 0, 3),
    ('Brown Sugar', 'Ingredients', 'KG', 5, 365, 110, 0.2, 0, 3),
    ('Paper Napkins', 'Supplies', 'Pack', 20, 1000, 55, 1.0, 0, 3),
    ('Chocolate Syrup', 'Add-ons', 'Bottle', 3, 180, 450, 0.1, 0, 3);
END

COMMIT;

-- 3. PREPARE TEMPORARY DATA
DECLARE @MenuItems TABLE (Id INT, Name NVARCHAR(MAX), Price DECIMAL(18,2));
INSERT INTO @MenuItems SELECT Id, Name, Price FROM [MenuItems] WHERE IsDeleted = 0;

DECLARE @StaffUsers TABLE (Id INT, Role NVARCHAR(50), Name NVARCHAR(MAX));
INSERT INTO @StaffUsers SELECT Id, Role, Name FROM [Users] WHERE Role IN ('Manager', 'Cashier', 'Chef', 'Waiter');

DECLARE @Products TABLE (Id INT, Name NVARCHAR(MAX), Price DECIMAL(18,2), Category NVARCHAR(MAX));
INSERT INTO @Products SELECT Id, Name, Price, Category FROM [Products] WHERE IsArchived = 0;

IF NOT EXISTS (SELECT 1 FROM @MenuItems)
BEGIN
    PRINT 'Error: No menu items found. Please add menu items first.';
    RETURN;
END

-- 4. MAIN DATA GENERATION LOOP
PRINT 'Generating Historical Data...';
DECLARE @OpeningCash DECIMAL(18,2) = 5000.00; 

BEGIN TRANSACTION;

WHILE @CurrentDate <= @EndDate
BEGIN
    DECLARE @DayStart DATETIME = CAST(@CurrentDate AS DATETIME);
    
    DECLARE @DailyTotalSales DECIMAL(18,2) = 0;
    DECLARE @DailyCashSales DECIMAL(18,2) = 0;
    DECLARE @DailyCardSales DECIMAL(18,2) = 0;
    DECLARE @DailyMobileSales DECIMAL(18,2) = 0;
    DECLARE @DailyOrdersCount INT = 0;
    DECLARE @DailyBookingRevenue DECIMAL(18,2) = 0;
    DECLARE @DailyBookingCount INT = 0;
    
    -- A. Generate Orders
    DECLARE @OrdersToCreate INT = @MinOrdersPerDay + (ABS(CHECKSUM(NEWID())) % (@MaxOrdersPerDay - @MinOrdersPerDay + 1));
    DECLARE @o INT = 0;

    WHILE @o < @OrdersToCreate
    BEGIN
        DECLARE @OrderTime DATETIME = DATEADD(second, ABS(CHECKSUM(NEWID())) % 50400, DATEADD(hour, 8, @DayStart));
        DECLARE @UserId INT, @UserName NVARCHAR(MAX);
        SELECT TOP 1 @UserId = Id, @UserName = Name FROM @StaffUsers WHERE Role IN ('Manager', 'Cashier') ORDER BY NEWID();

        DECLARE @OrderType NVARCHAR(50) = CASE ABS(CHECKSUM(NEWID())) % 2 WHEN 0 THEN 'dine-in' ELSE 'takeaway' END;
        
        -- Random Booking Charge (15% chance)
        DECLARE @BookingCharge DECIMAL(18,2) = 0;
        IF @OrderType = 'dine-in' AND ABS(CHECKSUM(NEWID())) % 100 < 15
        BEGIN
            SET @BookingCharge = CASE ABS(CHECKSUM(NEWID())) % 3 WHEN 0 THEN 50 WHEN 1 THEN 100 ELSE 200 END;
            SET @DailyBookingRevenue = @DailyBookingRevenue + @BookingCharge;
            SET @DailyBookingCount = @DailyBookingCount + 1;
        END

        INSERT INTO [Orders] (
            [UserId], [OrderType], [TableNumber], [Status], 
            [Subtotal], [Tax], [ServiceCharge], [BookingCharge], [Total], 
            [PaymentStatus], [CreatedAt], [ReadyAt], [BookingId], [UpdatedAt]
        ) VALUES (
            @UserId, @OrderType, 
            CASE WHEN @OrderType = 'dine-in' THEN CAST((ABS(CHECKSUM(NEWID())) % 20 + 1) AS NVARCHAR) ELSE NULL END,
            'Completed',
            0, 0, 0, @BookingCharge, 0, 
            'paid', @OrderTime, DATEADD(minute, 20, @OrderTime), NULL, @OrderTime -- Set to NULL to avoid FK conflicts, UpdatedAt set to @OrderTime
        );

        DECLARE @NewOrderId INT = SCOPE_IDENTITY();
        DECLARE @ItemsToCreate INT = 1 + (ABS(CHECKSUM(NEWID())) % 3);
        DECLARE @i INT = 0;
        DECLARE @RunningSubtotal DECIMAL(18,2) = 0;

        WHILE @i < @ItemsToCreate
        BEGIN
            DECLARE @MenuId INT, @MenuName NVARCHAR(MAX), @MenuPrice DECIMAL(18,2);
            SELECT TOP 1 @MenuId = Id, @MenuName = Name, @MenuPrice = Price FROM @MenuItems ORDER BY NEWID();
            DECLARE @Qty INT = 1 + (ABS(CHECKSUM(NEWID())) % 2);
            
            INSERT INTO [OrderItems] ([OrderId], [MenuItemId], [Name], [Quantity], [Price])
            VALUES (@NewOrderId, @MenuId, @MenuName, @Qty, @MenuPrice);

            SET @RunningSubtotal = @RunningSubtotal + (@MenuPrice * @Qty);
            SET @i = @i + 1;
        END

        DECLARE @TaxAmt DECIMAL(18,2) = ROUND(@RunningSubtotal * @TaxRate, 2);
        DECLARE @TotalAmt DECIMAL(18,2) = @RunningSubtotal + @TaxAmt + @BookingCharge;
        
        UPDATE [Orders] SET [Subtotal] = @RunningSubtotal, [Tax] = @TaxAmt, [Total] = @TotalAmt WHERE [Id] = @NewOrderId;

        -- Payment
        DECLARE @Method NVARCHAR(50) = CASE ABS(CHECKSUM(NEWID())) % 3 WHEN 0 THEN 'Cash' WHEN 1 THEN 'Card' ELSE 'Mobile' END;
        INSERT INTO [Payments] ([OrderId], [Amount], [Method], [IsSplit], [PaymentDate])
        VALUES (@NewOrderId, @TotalAmt, @Method, 0, @OrderTime);

        SET @DailyTotalSales = @DailyTotalSales + @TotalAmt;
        IF @Method = 'Cash' SET @DailyCashSales = @DailyCashSales + @TotalAmt;
        ELSE IF @Method = 'Card' SET @DailyCardSales = @DailyCardSales + @TotalAmt;
        ELSE SET @DailyMobileSales = @DailyMobileSales + @TotalAmt;
        
        SET @DailyOrdersCount = @DailyOrdersCount + 1;
        SET @o = @o + 1;
    END

    -- B. Generate random Cash Transactions
    DECLARE @ManagerAdded DECIMAL(18,2) = 0;
    DECLARE @ManagerRemoved DECIMAL(18,2) = 0;
    IF ABS(CHECKSUM(NEWID())) % 100 < 40
    BEGIN
        DECLARE @AdjType NVARCHAR(10) = CASE ABS(CHECKSUM(NEWID())) % 2 WHEN 0 THEN 'Add' ELSE 'Remove' END;
        DECLARE @AdjAmount DECIMAL(18,2) = 200 + (ABS(CHECKSUM(NEWID())) % 800);
        INSERT INTO [CashTransactions] ([Amount], [Type], [Reason], [Date], [UserId])
        VALUES (@AdjAmount, @AdjType, 'Daily Adjustment', DATEADD(hour, 11, @DayStart), (SELECT TOP 1 Id FROM @StaffUsers WHERE Role = 'Manager'));
        IF @AdjType = 'Add' SET @ManagerAdded = @AdjAmount; ELSE SET @ManagerRemoved = @AdjAmount;
    END

    -- C. Generate Cash Closing
    DECLARE @CashExpenses DECIMAL(18,2) = CASE WHEN ABS(CHECKSUM(NEWID())) % 100 < 10 THEN 100.00 ELSE 0 END;
    DECLARE @ActualCash DECIMAL(18,2) = @OpeningCash + @DailyCashSales + @ManagerAdded - @ManagerRemoved - @CashExpenses;
    INSERT INTO [CashClosings] (
        [Date], [CashInDrawer], [CashExpenses], [Notes], [TotalSales], [TotalOrders], 
        [CashSales], [CardSales], [MobileSales], [OpeningCash], [SubmittedByUserId], [SubmittedByUserName], [ClosedAt]
    ) VALUES (
        @DayStart, @ActualCash, @CashExpenses, 'Historical Data', @DailyTotalSales, @DailyOrdersCount,
        @DailyCashSales, @DailyCardSales, @DailyMobileSales, @OpeningCash, 
        (SELECT TOP 1 Id FROM @StaffUsers WHERE Role = 'Cashier'), 'History Bot', @DayStart
    );
    SET @OpeningCash = @ActualCash;

    -- D. STOCK PURCHASES (Every week)
    IF DATEPART(weekday, @CurrentDate) = 2 -- Monday
    BEGIN
        DECLARE @ProdId INT, @ProdPrice DECIMAL(18,2), @ProdName NVARCHAR(MAX);
        SELECT TOP 1 @ProdId = Id, @ProdPrice = Price, @ProdName = Name FROM @Products ORDER BY NEWID();
        DECLARE @BuyQty DECIMAL(18,2) = 10 + (ABS(CHECKSUM(NEWID())) % 20);
        
        INSERT INTO [StockBatches] ([ProductId], [Quantity], [ReceivedDate], [ExpiryDate], [CostPerUnit], [IsActive], [Supplier])
        VALUES (@ProdId, @BuyQty, @DayStart, DATEADD(day, 30, @DayStart), @ProdPrice, 1, 'Main Supplier');
        
        DECLARE @BatchId INT = SCOPE_IDENTITY();
        INSERT INTO [StockTransactions] ([ProductId], [BatchId], [Change], [Type], [Reason], [PerformedBy], [Date])
        VALUES (@ProdId, @BatchId, @BuyQty, 'Purchase', 'Weekly Stockup', 'Manager', DATEADD(hour, 9, @DayStart));
    END

    -- E. STOCK WASTAGE (Every 2 weeks)
    IF DAY(@CurrentDate) % 14 = 0
    BEGIN
        DECLARE @WasteProdId INT, @WastePrice DECIMAL(18,2);
        SELECT TOP 1 @WasteProdId = Id, @WastePrice = Price FROM @Products ORDER BY NEWID();
        DECLARE @WasteQty DECIMAL(18,2) = 1 + (ABS(CHECKSUM(NEWID())) % 3);
        
        DECLARE @TargetBatchId INT = (SELECT TOP 1 Id FROM [StockBatches] WHERE ProductId = @WasteProdId ORDER BY Id DESC);
        
        INSERT INTO [StockTransactions] ([ProductId], [BatchId], [Change], [Type], [Reason], [PerformedBy], [Date])
        VALUES (@WasteProdId, @TargetBatchId, -@WasteQty, 
                CASE ABS(CHECKSUM(NEWID())) % 2 WHEN 0 THEN 'Adjustment' ELSE 'Expired' END, 
                CASE ABS(CHECKSUM(NEWID())) % 2 WHEN 0 THEN 'Damaged' ELSE 'Spoiled' END, 
                'Manager', DATEADD(hour, 16, @DayStart));
    END

    SET @CurrentDate = DATEADD(day, 1, @CurrentDate);
END

COMMIT;
PRINT 'SUCCESS: Full historical data generated without Foreign Key conflicts!';
