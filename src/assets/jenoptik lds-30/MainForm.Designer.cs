namespace RSA_Laser_Test_App
{
	// Token: 0x0200000D RID: 13
	public partial class MainForm : global::System.Windows.Forms.Form
	{
		// Token: 0x06000077 RID: 119 RVA: 0x00007870 File Offset: 0x00005A70
		protected override void Dispose(bool disposing)
		{
			if (disposing && this.components != null)
			{
				this.components.Dispose();
			}
			base.Dispose(disposing);
		}

		// Token: 0x06000078 RID: 120 RVA: 0x00007890 File Offset: 0x00005A90
		private void InitializeComponent()
		{
            this.components = new System.ComponentModel.Container();
            this.txtbxBaseHeight = new System.Windows.Forms.TextBox();
            this.lblBaseHeight = new System.Windows.Forms.Label();
            this.btnLaserStart = new System.Windows.Forms.Button();
            this.btnLaserStop = new System.Windows.Forms.Button();
            this.btnLogStart = new System.Windows.Forms.Button();
            this.btnLogStop = new System.Windows.Forms.Button();
            this.txtbxLogFilename = new System.Windows.Forms.TextBox();
            this.btnResetMinimum = new System.Windows.Forms.Button();
            this.lblCurTimeStamp = new System.Windows.Forms.Label();
            this.lblCurLaserData = new System.Windows.Forms.Label();
            this.lblMinHeightMeas = new System.Windows.Forms.Label();
            this.txtbxCurTimeStamp = new System.Windows.Forms.TextBox();
            this.txtbxCurLaserData = new System.Windows.Forms.TextBox();
            this.txtbxMinHeightMeas = new System.Windows.Forms.TextBox();
            this.grpbxSetup = new System.Windows.Forms.GroupBox();
            this.lblCurrentLoggingMode = new System.Windows.Forms.Label();
            this.cmbobxCurrentLoggingMode = new System.Windows.Forms.ComboBox();
            this.lblTemperature = new System.Windows.Forms.Label();
            this.txtbxTemperature = new System.Windows.Forms.TextBox();
            this.lblRouteSegment = new System.Windows.Forms.Label();
            this.txtbxRouteSegment = new System.Windows.Forms.TextBox();
            this.txtbxMaxHeight2 = new System.Windows.Forms.TextBox();
            this.lblMaxHeight = new System.Windows.Forms.Label();
            this.btnSetMaxHeight = new System.Windows.Forms.Button();
            this.txtbxMaxHeight = new System.Windows.Forms.TextBox();
            this.txtbxAlarmHeight2 = new System.Windows.Forms.TextBox();
            this.txtbxBaseHeight2 = new System.Windows.Forms.TextBox();
            this.btnChgUnits = new System.Windows.Forms.Button();
            this.lblAlarmHeight = new System.Windows.Forms.Label();
            this.btnSetAlarmHeight = new System.Windows.Forms.Button();
            this.txtbxAlarmHeight = new System.Windows.Forms.TextBox();
            this.btnSetBaseHeight = new System.Windows.Forms.Button();
            this.grpbxData = new System.Windows.Forms.GroupBox();
            this.lblLaserQueue = new System.Windows.Forms.Label();
            this.lblGpsQueue = new System.Windows.Forms.Label();
            this.lblLaserQueueDepth = new System.Windows.Forms.Label();
            this.lblGpsQueueDepth = new System.Windows.Forms.Label();
            this.lblInsufficientSatellites = new System.Windows.Forms.Label();
            this.btnManualLogEntry = new System.Windows.Forms.Button();
            this.lstbxLogEntries = new System.Windows.Forms.ListBox();
            this.btnClearAllNoLog = new System.Windows.Forms.Button();
            this.btnResetMinNoLog = new System.Windows.Forms.Button();
            this.btnClearNoteObj = new System.Windows.Forms.Button();
            this.btnClearObject = new System.Windows.Forms.Button();
            this.btnClearAll = new System.Windows.Forms.Button();
            this.cmbobxObstructionType = new System.Windows.Forms.ComboBox();
            this.lblObstructionType = new System.Windows.Forms.Label();
            this.btnLogNotes = new System.Windows.Forms.Button();
            this.lblNotes = new System.Windows.Forms.Label();
            this.btnClearNotes = new System.Windows.Forms.Button();
            this.txtbxNotes = new System.Windows.Forms.TextBox();
            this.txtbxCurGpsData = new System.Windows.Forms.TextBox();
            this.lblCurrGpsData = new System.Windows.Forms.Label();
            this.lblLogFilename = new System.Windows.Forms.Label();
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.settingsToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.serialPortConfigurationToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.laserFilterParametersToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.gPSParametersToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.customizeLogFileToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.optionsToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.helpToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.tmrUpdateFields = new System.Windows.Forms.Timer(this.components);
            this.tooltipLaserTestForm = new System.Windows.Forms.ToolTip(this.components);
            this.grpbxSetup.SuspendLayout();
            this.grpbxData.SuspendLayout();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // txtbxBaseHeight
            // 
            this.txtbxBaseHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxBaseHeight.Location = new System.Drawing.Point(450, 19);
            this.txtbxBaseHeight.Name = "txtbxBaseHeight";
            this.txtbxBaseHeight.Size = new System.Drawing.Size(107, 20);
            this.txtbxBaseHeight.TabIndex = 6;
            this.txtbxBaseHeight.Text = "0.0";
            // 
            // lblBaseHeight
            // 
            this.lblBaseHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblBaseHeight.AutoSize = true;
            this.lblBaseHeight.Location = new System.Drawing.Point(376, 22);
            this.lblBaseHeight.Name = "lblBaseHeight";
            this.lblBaseHeight.Size = new System.Drawing.Size(68, 13);
            this.lblBaseHeight.TabIndex = 5;
            this.lblBaseHeight.Text = "Base Height:";
            // 
            // btnLaserStart
            // 
            this.btnLaserStart.Location = new System.Drawing.Point(9, 19);
            this.btnLaserStart.Name = "btnLaserStart";
            this.btnLaserStart.Size = new System.Drawing.Size(94, 49);
            this.btnLaserStart.TabIndex = 0;
            this.btnLaserStart.Text = "Start Laser Measurement";
            this.btnLaserStart.UseVisualStyleBackColor = true;
            this.btnLaserStart.Click += new System.EventHandler(this.btnLaserStart_Click);
            // 
            // btnLaserStop
            // 
            this.btnLaserStop.Location = new System.Drawing.Point(109, 19);
            this.btnLaserStop.Name = "btnLaserStop";
            this.btnLaserStop.Size = new System.Drawing.Size(94, 49);
            this.btnLaserStop.TabIndex = 1;
            this.btnLaserStop.Text = "Stop Laser Measurement";
            this.btnLaserStop.UseVisualStyleBackColor = true;
            this.btnLaserStop.Click += new System.EventHandler(this.btnLaserStop_Click);
            // 
            // btnLogStart
            // 
            this.btnLogStart.Location = new System.Drawing.Point(9, 76);
            this.btnLogStart.Name = "btnLogStart";
            this.btnLogStart.Size = new System.Drawing.Size(94, 49);
            this.btnLogStart.TabIndex = 2;
            this.btnLogStart.Text = "Start New Data Log";
            this.btnLogStart.UseVisualStyleBackColor = true;
            this.btnLogStart.Click += new System.EventHandler(this.btnLogStart_Click);
            // 
            // btnLogStop
            // 
            this.btnLogStop.Location = new System.Drawing.Point(109, 76);
            this.btnLogStop.Name = "btnLogStop";
            this.btnLogStop.Size = new System.Drawing.Size(94, 49);
            this.btnLogStop.TabIndex = 3;
            this.btnLogStop.Text = "Stop Logging";
            this.btnLogStop.UseVisualStyleBackColor = true;
            this.btnLogStop.Click += new System.EventHandler(this.btnLogStop_Click);
            // 
            // txtbxLogFilename
            // 
            this.txtbxLogFilename.Font = new System.Drawing.Font("Courier New", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxLogFilename.Location = new System.Drawing.Point(6, 125);
            this.txtbxLogFilename.Name = "txtbxLogFilename";
            this.txtbxLogFilename.ReadOnly = true;
            this.txtbxLogFilename.Size = new System.Drawing.Size(303, 21);
            this.txtbxLogFilename.TabIndex = 27;
            // 
            // btnResetMinimum
            // 
            this.btnResetMinimum.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnResetMinimum.Location = new System.Drawing.Point(329, 180);
            this.btnResetMinimum.Name = "btnResetMinimum";
            this.btnResetMinimum.Size = new System.Drawing.Size(146, 49);
            this.btnResetMinimum.TabIndex = 36;
            this.btnResetMinimum.Text = "Reset Min (log)\r\n<F1>";
            this.btnResetMinimum.UseVisualStyleBackColor = true;
            this.btnResetMinimum.Visible = false;
            this.btnResetMinimum.Click += new System.EventHandler(this.btnResetMinimum_Click);
            // 
            // lblCurTimeStamp
            // 
            this.lblCurTimeStamp.AutoSize = true;
            this.lblCurTimeStamp.Location = new System.Drawing.Point(6, 65);
            this.lblCurTimeStamp.Name = "lblCurTimeStamp";
            this.lblCurTimeStamp.Size = new System.Drawing.Size(100, 13);
            this.lblCurTimeStamp.TabIndex = 22;
            this.lblCurTimeStamp.Text = "Current Time Stamp";
            // 
            // lblCurLaserData
            // 
            this.lblCurLaserData.AutoSize = true;
            this.lblCurLaserData.Location = new System.Drawing.Point(244, 65);
            this.lblCurLaserData.Name = "lblCurLaserData";
            this.lblCurLaserData.Size = new System.Drawing.Size(96, 13);
            this.lblCurLaserData.TabIndex = 24;
            this.lblCurLaserData.Text = "Current Laser Data";
            // 
            // lblMinHeightMeas
            // 
            this.lblMinHeightMeas.AutoSize = true;
            this.lblMinHeightMeas.Font = new System.Drawing.Font("Microsoft Sans Serif", 15.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblMinHeightMeas.Location = new System.Drawing.Point(6, 152);
            this.lblMinHeightMeas.Name = "lblMinHeightMeas";
            this.lblMinHeightMeas.Size = new System.Drawing.Size(303, 25);
            this.lblMinHeightMeas.TabIndex = 28;
            this.lblMinHeightMeas.Text = "Minimum Height Measurement";
            // 
            // txtbxCurTimeStamp
            // 
            this.txtbxCurTimeStamp.Font = new System.Drawing.Font("Courier New", 10.2F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxCurTimeStamp.Location = new System.Drawing.Point(6, 81);
            this.txtbxCurTimeStamp.Name = "txtbxCurTimeStamp";
            this.txtbxCurTimeStamp.ReadOnly = true;
            this.txtbxCurTimeStamp.Size = new System.Drawing.Size(235, 23);
            this.txtbxCurTimeStamp.TabIndex = 23;
            // 
            // txtbxCurLaserData
            // 
            this.txtbxCurLaserData.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxCurLaserData.Font = new System.Drawing.Font("Courier New", 10.2F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxCurLaserData.Location = new System.Drawing.Point(247, 81);
            this.txtbxCurLaserData.Name = "txtbxCurLaserData";
            this.txtbxCurLaserData.ReadOnly = true;
            this.txtbxCurLaserData.Size = new System.Drawing.Size(398, 23);
            this.txtbxCurLaserData.TabIndex = 25;
            // 
            // txtbxMinHeightMeas
            // 
            this.txtbxMinHeightMeas.Font = new System.Drawing.Font("Microsoft Sans Serif", 27.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxMinHeightMeas.Location = new System.Drawing.Point(6, 180);
            this.txtbxMinHeightMeas.Name = "txtbxMinHeightMeas";
            this.txtbxMinHeightMeas.ReadOnly = true;
            this.txtbxMinHeightMeas.Size = new System.Drawing.Size(303, 49);
            this.txtbxMinHeightMeas.TabIndex = 29;
            // 
            // grpbxSetup
            // 
            this.grpbxSetup.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.grpbxSetup.Controls.Add(this.lblCurrentLoggingMode);
            this.grpbxSetup.Controls.Add(this.cmbobxCurrentLoggingMode);
            this.grpbxSetup.Controls.Add(this.lblTemperature);
            this.grpbxSetup.Controls.Add(this.txtbxTemperature);
            this.grpbxSetup.Controls.Add(this.lblRouteSegment);
            this.grpbxSetup.Controls.Add(this.txtbxRouteSegment);
            this.grpbxSetup.Controls.Add(this.txtbxMaxHeight2);
            this.grpbxSetup.Controls.Add(this.lblMaxHeight);
            this.grpbxSetup.Controls.Add(this.btnSetMaxHeight);
            this.grpbxSetup.Controls.Add(this.txtbxMaxHeight);
            this.grpbxSetup.Controls.Add(this.txtbxAlarmHeight2);
            this.grpbxSetup.Controls.Add(this.txtbxBaseHeight2);
            this.grpbxSetup.Controls.Add(this.btnChgUnits);
            this.grpbxSetup.Controls.Add(this.lblAlarmHeight);
            this.grpbxSetup.Controls.Add(this.btnSetAlarmHeight);
            this.grpbxSetup.Controls.Add(this.txtbxAlarmHeight);
            this.grpbxSetup.Controls.Add(this.btnSetBaseHeight);
            this.grpbxSetup.Controls.Add(this.btnLaserStop);
            this.grpbxSetup.Controls.Add(this.btnLaserStart);
            this.grpbxSetup.Controls.Add(this.lblBaseHeight);
            this.grpbxSetup.Controls.Add(this.txtbxBaseHeight);
            this.grpbxSetup.Controls.Add(this.btnLogStart);
            this.grpbxSetup.Controls.Add(this.btnLogStop);
            this.grpbxSetup.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.grpbxSetup.Location = new System.Drawing.Point(10, 34);
            this.grpbxSetup.Name = "grpbxSetup";
            this.grpbxSetup.RightToLeft = System.Windows.Forms.RightToLeft.No;
            this.grpbxSetup.Size = new System.Drawing.Size(651, 178);
            this.grpbxSetup.TabIndex = 50;
            this.grpbxSetup.TabStop = false;
            this.grpbxSetup.Text = "Setup";
            // 
            // lblCurrentLoggingMode
            // 
            this.lblCurrentLoggingMode.AutoSize = true;
            this.lblCurrentLoggingMode.Location = new System.Drawing.Point(6, 132);
            this.lblCurrentLoggingMode.Name = "lblCurrentLoggingMode";
            this.lblCurrentLoggingMode.Size = new System.Drawing.Size(78, 13);
            this.lblCurrentLoggingMode.TabIndex = 33;
            this.lblCurrentLoggingMode.Text = "Logging Mode:";
            // 
            // cmbobxCurrentLoggingMode
            // 
            this.cmbobxCurrentLoggingMode.AutoCompleteMode = System.Windows.Forms.AutoCompleteMode.SuggestAppend;
            this.cmbobxCurrentLoggingMode.AutoCompleteSource = System.Windows.Forms.AutoCompleteSource.ListItems;
            this.cmbobxCurrentLoggingMode.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cmbobxCurrentLoggingMode.Font = new System.Drawing.Font("Courier New", 9.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.cmbobxCurrentLoggingMode.FormattingEnabled = true;
            this.cmbobxCurrentLoggingMode.Location = new System.Drawing.Point(9, 148);
            this.cmbobxCurrentLoggingMode.MaxDropDownItems = 10;
            this.cmbobxCurrentLoggingMode.Name = "cmbobxCurrentLoggingMode";
            this.cmbobxCurrentLoggingMode.Size = new System.Drawing.Size(194, 24);
            this.cmbobxCurrentLoggingMode.TabIndex = 32;
            this.cmbobxCurrentLoggingMode.SelectedIndexChanged += new System.EventHandler(this.cmbobxCurrentLoggingMode_SelectedIndexChanged);
            // 
            // lblTemperature
            // 
            this.lblTemperature.AutoSize = true;
            this.lblTemperature.Location = new System.Drawing.Point(223, 153);
            this.lblTemperature.Name = "lblTemperature";
            this.lblTemperature.Size = new System.Drawing.Size(70, 13);
            this.lblTemperature.TabIndex = 20;
            this.lblTemperature.Text = "Temperature:";
            // 
            // txtbxTemperature
            // 
            this.txtbxTemperature.Location = new System.Drawing.Point(297, 150);
            this.txtbxTemperature.Name = "txtbxTemperature";
            this.txtbxTemperature.Size = new System.Drawing.Size(60, 20);
            this.txtbxTemperature.TabIndex = 21;
            // 
            // lblRouteSegment
            // 
            this.lblRouteSegment.AutoSize = true;
            this.lblRouteSegment.Location = new System.Drawing.Point(223, 132);
            this.lblRouteSegment.Name = "lblRouteSegment";
            this.lblRouteSegment.Size = new System.Drawing.Size(39, 13);
            this.lblRouteSegment.TabIndex = 18;
            this.lblRouteSegment.Text = "Route:";
            // 
            // txtbxRouteSegment
            // 
            this.txtbxRouteSegment.Location = new System.Drawing.Point(297, 129);
            this.txtbxRouteSegment.Name = "txtbxRouteSegment";
            this.txtbxRouteSegment.Size = new System.Drawing.Size(60, 20);
            this.txtbxRouteSegment.TabIndex = 19;
            // 
            // txtbxMaxHeight2
            // 
            this.txtbxMaxHeight2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxMaxHeight2.Location = new System.Drawing.Point(450, 150);
            this.txtbxMaxHeight2.Name = "txtbxMaxHeight2";
            this.txtbxMaxHeight2.ReadOnly = true;
            this.txtbxMaxHeight2.Size = new System.Drawing.Size(107, 20);
            this.txtbxMaxHeight2.TabIndex = 16;
            this.txtbxMaxHeight2.Text = "0.0";
            // 
            // lblMaxHeight
            // 
            this.lblMaxHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblMaxHeight.AutoSize = true;
            this.lblMaxHeight.Location = new System.Drawing.Point(374, 132);
            this.lblMaxHeight.Name = "lblMaxHeight";
            this.lblMaxHeight.Size = new System.Drawing.Size(64, 13);
            this.lblMaxHeight.TabIndex = 13;
            this.lblMaxHeight.Text = "Max Height:";
            // 
            // btnSetMaxHeight
            // 
            this.btnSetMaxHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnSetMaxHeight.Location = new System.Drawing.Point(563, 129);
            this.btnSetMaxHeight.Name = "btnSetMaxHeight";
            this.btnSetMaxHeight.Size = new System.Drawing.Size(82, 36);
            this.btnSetMaxHeight.TabIndex = 15;
            this.btnSetMaxHeight.Text = "Set Max Height";
            this.btnSetMaxHeight.UseVisualStyleBackColor = true;
            this.btnSetMaxHeight.Click += new System.EventHandler(this.btnSetMaxHeight_Click);
            // 
            // txtbxMaxHeight
            // 
            this.txtbxMaxHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxMaxHeight.Location = new System.Drawing.Point(450, 129);
            this.txtbxMaxHeight.Name = "txtbxMaxHeight";
            this.txtbxMaxHeight.Size = new System.Drawing.Size(107, 20);
            this.txtbxMaxHeight.TabIndex = 14;
            this.txtbxMaxHeight.Text = "0.0";
            // 
            // txtbxAlarmHeight2
            // 
            this.txtbxAlarmHeight2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxAlarmHeight2.Location = new System.Drawing.Point(450, 95);
            this.txtbxAlarmHeight2.Name = "txtbxAlarmHeight2";
            this.txtbxAlarmHeight2.ReadOnly = true;
            this.txtbxAlarmHeight2.Size = new System.Drawing.Size(107, 20);
            this.txtbxAlarmHeight2.TabIndex = 12;
            this.txtbxAlarmHeight2.Text = "0.0";
            // 
            // txtbxBaseHeight2
            // 
            this.txtbxBaseHeight2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxBaseHeight2.Location = new System.Drawing.Point(450, 40);
            this.txtbxBaseHeight2.Name = "txtbxBaseHeight2";
            this.txtbxBaseHeight2.ReadOnly = true;
            this.txtbxBaseHeight2.Size = new System.Drawing.Size(107, 20);
            this.txtbxBaseHeight2.TabIndex = 8;
            this.txtbxBaseHeight2.Text = "0.0";
            // 
            // btnChgUnits
            // 
            this.btnChgUnits.Location = new System.Drawing.Point(247, 19);
            this.btnChgUnits.Name = "btnChgUnits";
            this.btnChgUnits.Size = new System.Drawing.Size(94, 49);
            this.btnChgUnits.TabIndex = 4;
            this.btnChgUnits.Text = "Change Metric/English Units";
            this.btnChgUnits.UseVisualStyleBackColor = true;
            this.btnChgUnits.Click += new System.EventHandler(this.btnChgUnits_Click);
            // 
            // lblAlarmHeight
            // 
            this.lblAlarmHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblAlarmHeight.AutoSize = true;
            this.lblAlarmHeight.Location = new System.Drawing.Point(374, 77);
            this.lblAlarmHeight.Name = "lblAlarmHeight";
            this.lblAlarmHeight.Size = new System.Drawing.Size(70, 13);
            this.lblAlarmHeight.TabIndex = 9;
            this.lblAlarmHeight.Text = "Alarm Height:";
            // 
            // btnSetAlarmHeight
            // 
            this.btnSetAlarmHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnSetAlarmHeight.Location = new System.Drawing.Point(563, 74);
            this.btnSetAlarmHeight.Name = "btnSetAlarmHeight";
            this.btnSetAlarmHeight.Size = new System.Drawing.Size(82, 36);
            this.btnSetAlarmHeight.TabIndex = 11;
            this.btnSetAlarmHeight.Text = "Set Alarm Height";
            this.btnSetAlarmHeight.UseVisualStyleBackColor = true;
            this.btnSetAlarmHeight.Click += new System.EventHandler(this.btnSetAlarmHeight_Click);
            // 
            // txtbxAlarmHeight
            // 
            this.txtbxAlarmHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxAlarmHeight.Location = new System.Drawing.Point(450, 74);
            this.txtbxAlarmHeight.Name = "txtbxAlarmHeight";
            this.txtbxAlarmHeight.Size = new System.Drawing.Size(107, 20);
            this.txtbxAlarmHeight.TabIndex = 10;
            this.txtbxAlarmHeight.Text = "0.0";
            // 
            // btnSetBaseHeight
            // 
            this.btnSetBaseHeight.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnSetBaseHeight.Location = new System.Drawing.Point(563, 19);
            this.btnSetBaseHeight.Name = "btnSetBaseHeight";
            this.btnSetBaseHeight.Size = new System.Drawing.Size(82, 36);
            this.btnSetBaseHeight.TabIndex = 7;
            this.btnSetBaseHeight.Text = "Set Base Height";
            this.btnSetBaseHeight.UseVisualStyleBackColor = true;
            this.btnSetBaseHeight.Click += new System.EventHandler(this.btnSetBaseHeight_Click);
            // 
            // grpbxData
            // 
            this.grpbxData.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.grpbxData.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.grpbxData.Controls.Add(this.lblLaserQueue);
            this.grpbxData.Controls.Add(this.lblGpsQueue);
            this.grpbxData.Controls.Add(this.lblLaserQueueDepth);
            this.grpbxData.Controls.Add(this.lblGpsQueueDepth);
            this.grpbxData.Controls.Add(this.lblInsufficientSatellites);
            this.grpbxData.Controls.Add(this.btnManualLogEntry);
            this.grpbxData.Controls.Add(this.lstbxLogEntries);
            this.grpbxData.Controls.Add(this.btnClearAllNoLog);
            this.grpbxData.Controls.Add(this.btnResetMinNoLog);
            this.grpbxData.Controls.Add(this.btnClearNoteObj);
            this.grpbxData.Controls.Add(this.btnClearObject);
            this.grpbxData.Controls.Add(this.btnClearAll);
            this.grpbxData.Controls.Add(this.cmbobxObstructionType);
            this.grpbxData.Controls.Add(this.lblObstructionType);
            this.grpbxData.Controls.Add(this.btnLogNotes);
            this.grpbxData.Controls.Add(this.lblNotes);
            this.grpbxData.Controls.Add(this.btnClearNotes);
            this.grpbxData.Controls.Add(this.txtbxNotes);
            this.grpbxData.Controls.Add(this.txtbxCurGpsData);
            this.grpbxData.Controls.Add(this.lblCurrGpsData);
            this.grpbxData.Controls.Add(this.lblLogFilename);
            this.grpbxData.Controls.Add(this.txtbxMinHeightMeas);
            this.grpbxData.Controls.Add(this.txtbxCurLaserData);
            this.grpbxData.Controls.Add(this.txtbxCurTimeStamp);
            this.grpbxData.Controls.Add(this.lblMinHeightMeas);
            this.grpbxData.Controls.Add(this.txtbxLogFilename);
            this.grpbxData.Controls.Add(this.lblCurLaserData);
            this.grpbxData.Controls.Add(this.lblCurTimeStamp);
            this.grpbxData.Controls.Add(this.btnResetMinimum);
            this.grpbxData.Location = new System.Drawing.Point(10, 218);
            this.grpbxData.Name = "grpbxData";
            this.grpbxData.Size = new System.Drawing.Size(651, 465);
            this.grpbxData.TabIndex = 51;
            this.grpbxData.TabStop = false;
            this.grpbxData.Text = "Data";
            // 
            // lblLaserQueue
            // 
            this.lblLaserQueue.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblLaserQueue.AutoSize = true;
            this.lblLaserQueue.ForeColor = System.Drawing.Color.DarkGray;
            this.lblLaserQueue.Location = new System.Drawing.Point(547, 65);
            this.lblLaserQueue.Name = "lblLaserQueue";
            this.lblLaserQueue.Size = new System.Drawing.Size(42, 13);
            this.lblLaserQueue.TabIndex = 49;
            this.lblLaserQueue.Text = "Queue:";
            // 
            // lblGpsQueue
            // 
            this.lblGpsQueue.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblGpsQueue.AutoSize = true;
            this.lblGpsQueue.ForeColor = System.Drawing.Color.DarkGray;
            this.lblGpsQueue.Location = new System.Drawing.Point(547, 22);
            this.lblGpsQueue.Name = "lblGpsQueue";
            this.lblGpsQueue.Size = new System.Drawing.Size(42, 13);
            this.lblGpsQueue.TabIndex = 48;
            this.lblGpsQueue.Text = "Queue:";
            // 
            // lblLaserQueueDepth
            // 
            this.lblLaserQueueDepth.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblLaserQueueDepth.ForeColor = System.Drawing.Color.DarkGray;
            this.lblLaserQueueDepth.Location = new System.Drawing.Point(595, 65);
            this.lblLaserQueueDepth.Name = "lblLaserQueueDepth";
            this.lblLaserQueueDepth.Size = new System.Drawing.Size(50, 13);
            this.lblLaserQueueDepth.TabIndex = 47;
            this.lblLaserQueueDepth.Text = "12345";
            this.lblLaserQueueDepth.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
            // 
            // lblGpsQueueDepth
            // 
            this.lblGpsQueueDepth.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.lblGpsQueueDepth.ForeColor = System.Drawing.Color.DarkGray;
            this.lblGpsQueueDepth.Location = new System.Drawing.Point(595, 22);
            this.lblGpsQueueDepth.Name = "lblGpsQueueDepth";
            this.lblGpsQueueDepth.Size = new System.Drawing.Size(50, 13);
            this.lblGpsQueueDepth.TabIndex = 46;
            this.lblGpsQueueDepth.Text = "12345";
            this.lblGpsQueueDepth.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
            // 
            // lblInsufficientSatellites
            // 
            this.lblInsufficientSatellites.AutoSize = true;
            this.lblInsufficientSatellites.BackColor = System.Drawing.Color.Red;
            this.lblInsufficientSatellites.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblInsufficientSatellites.ForeColor = System.Drawing.Color.White;
            this.lblInsufficientSatellites.Location = new System.Drawing.Point(111, 22);
            this.lblInsufficientSatellites.Name = "lblInsufficientSatellites";
            this.lblInsufficientSatellites.Size = new System.Drawing.Size(394, 13);
            this.lblInsufficientSatellites.TabIndex = 45;
            this.lblInsufficientSatellites.Text = "(Not Enough Satellites for Accurate GPS Position, Logging Stopped)";
            // 
            // btnManualLogEntry
            // 
            this.btnManualLogEntry.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnManualLogEntry.ForeColor = System.Drawing.SystemColors.ControlText;
            this.btnManualLogEntry.Location = new System.Drawing.Point(499, 297);
            this.btnManualLogEntry.Name = "btnManualLogEntry";
            this.btnManualLogEntry.Size = new System.Drawing.Size(146, 49);
            this.btnManualLogEntry.TabIndex = 44;
            this.btnManualLogEntry.Text = "Manual Log Entry\r\n<Alt+Enter>";
            this.btnManualLogEntry.UseVisualStyleBackColor = true;
            this.btnManualLogEntry.Click += new System.EventHandler(this.btnManualLogEntry_Click);
            // 
            // lstbxLogEntries
            // 
            this.lstbxLogEntries.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.lstbxLogEntries.BackColor = System.Drawing.SystemColors.Info;
            this.lstbxLogEntries.Font = new System.Drawing.Font("Lucida Console", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lstbxLogEntries.FormattingEnabled = true;
            this.lstbxLogEntries.ItemHeight = 12;
            this.lstbxLogEntries.Location = new System.Drawing.Point(6, 407);
            this.lstbxLogEntries.Name = "lstbxLogEntries";
            this.lstbxLogEntries.ScrollAlwaysVisible = true;
            this.lstbxLogEntries.Size = new System.Drawing.Size(639, 52);
            this.lstbxLogEntries.TabIndex = 43;
            // 
            // btnClearAllNoLog
            // 
            this.btnClearAllNoLog.Font = new System.Drawing.Font("Microsoft Sans Serif", 9.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnClearAllNoLog.ForeColor = System.Drawing.Color.Red;
            this.btnClearAllNoLog.Location = new System.Drawing.Point(499, 125);
            this.btnClearAllNoLog.Name = "btnClearAllNoLog";
            this.btnClearAllNoLog.Size = new System.Drawing.Size(146, 49);
            this.btnClearAllNoLog.TabIndex = 37;
            this.btnClearAllNoLog.Text = "Rst/Clr All (no log)\r\n<Shift+F12>";
            this.btnClearAllNoLog.UseVisualStyleBackColor = true;
            this.btnClearAllNoLog.Click += new System.EventHandler(this.btnClearAllNoLog_Click);
            // 
            // btnResetMinNoLog
            // 
            this.btnResetMinNoLog.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnResetMinNoLog.Location = new System.Drawing.Point(329, 125);
            this.btnResetMinNoLog.Name = "btnResetMinNoLog";
            this.btnResetMinNoLog.Size = new System.Drawing.Size(146, 49);
            this.btnResetMinNoLog.TabIndex = 35;
            this.btnResetMinNoLog.Text = "Reset Min (no log)\r\n<F12>";
            this.btnResetMinNoLog.UseVisualStyleBackColor = true;
            this.btnResetMinNoLog.Click += new System.EventHandler(this.btnResetMinNoLog_Click);
            // 
            // btnClearNoteObj
            // 
            this.btnClearNoteObj.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnClearNoteObj.ForeColor = System.Drawing.Color.Red;
            this.btnClearNoteObj.Location = new System.Drawing.Point(499, 237);
            this.btnClearNoteObj.Name = "btnClearNoteObj";
            this.btnClearNoteObj.Size = new System.Drawing.Size(146, 49);
            this.btnClearNoteObj.TabIndex = 41;
            this.btnClearNoteObj.Text = "Clear Note+Obj \r\n<Shift+F2>";
            this.btnClearNoteObj.UseVisualStyleBackColor = true;
            this.btnClearNoteObj.Click += new System.EventHandler(this.btnClearNoteObj_Click);
            // 
            // btnClearObject
            // 
            this.btnClearObject.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnClearObject.Location = new System.Drawing.Point(329, 237);
            this.btnClearObject.Name = "btnClearObject";
            this.btnClearObject.Size = new System.Drawing.Size(146, 49);
            this.btnClearObject.TabIndex = 39;
            this.btnClearObject.Text = "Clear Object \r\n<Shift+F3>";
            this.btnClearObject.UseVisualStyleBackColor = true;
            this.btnClearObject.Click += new System.EventHandler(this.btnClearObject_Click);
            // 
            // btnClearAll
            // 
            this.btnClearAll.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnClearAll.ForeColor = System.Drawing.Color.Red;
            this.btnClearAll.Location = new System.Drawing.Point(499, 180);
            this.btnClearAll.Name = "btnClearAll";
            this.btnClearAll.Size = new System.Drawing.Size(146, 49);
            this.btnClearAll.TabIndex = 38;
            this.btnClearAll.Text = "Reset/Clear All\r\n<Shift+F1>";
            this.btnClearAll.UseVisualStyleBackColor = true;
            this.btnClearAll.Visible = false;
            this.btnClearAll.Click += new System.EventHandler(this.btnClearAll_Click);
            // 
            // cmbobxObstructionType
            // 
            this.cmbobxObstructionType.AutoCompleteMode = System.Windows.Forms.AutoCompleteMode.SuggestAppend;
            this.cmbobxObstructionType.AutoCompleteSource = System.Windows.Forms.AutoCompleteSource.ListItems;
            this.cmbobxObstructionType.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cmbobxObstructionType.Font = new System.Drawing.Font("Courier New", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.cmbobxObstructionType.FormattingEnabled = true;
            this.cmbobxObstructionType.Location = new System.Drawing.Point(6, 260);
            this.cmbobxObstructionType.MaxDropDownItems = 10;
            this.cmbobxObstructionType.Name = "cmbobxObstructionType";
            this.cmbobxObstructionType.Size = new System.Drawing.Size(303, 26);
            this.cmbobxObstructionType.TabIndex = 31;
            // 
            // lblObstructionType
            // 
            this.lblObstructionType.AutoSize = true;
            this.lblObstructionType.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblObstructionType.Location = new System.Drawing.Point(7, 237);
            this.lblObstructionType.Name = "lblObstructionType";
            this.lblObstructionType.Size = new System.Drawing.Size(170, 20);
            this.lblObstructionType.TabIndex = 30;
            this.lblObstructionType.Text = "Obstruction Type <F3>";
            // 
            // btnLogNotes
            // 
            this.btnLogNotes.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnLogNotes.Location = new System.Drawing.Point(163, 297);
            this.btnLogNotes.Name = "btnLogNotes";
            this.btnLogNotes.Size = new System.Drawing.Size(146, 49);
            this.btnLogNotes.TabIndex = 34;
            this.btnLogNotes.Text = "Log Note\r\n<F2>";
            this.btnLogNotes.UseVisualStyleBackColor = true;
            this.btnLogNotes.Click += new System.EventHandler(this.btnLogNotes_Click);
            // 
            // lblNotes
            // 
            this.lblNotes.AutoSize = true;
            this.lblNotes.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblNotes.Location = new System.Drawing.Point(7, 326);
            this.lblNotes.Name = "lblNotes";
            this.lblNotes.Size = new System.Drawing.Size(84, 20);
            this.lblNotes.TabIndex = 32;
            this.lblNotes.Text = "Note <F4>";
            // 
            // btnClearNotes
            // 
            this.btnClearNotes.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnClearNotes.Location = new System.Drawing.Point(329, 297);
            this.btnClearNotes.Name = "btnClearNotes";
            this.btnClearNotes.Size = new System.Drawing.Size(146, 49);
            this.btnClearNotes.TabIndex = 40;
            this.btnClearNotes.Text = "Clear Note\r\n<Shift+F4>";
            this.btnClearNotes.UseVisualStyleBackColor = true;
            this.btnClearNotes.Click += new System.EventHandler(this.btnClearNotes_Click);
            // 
            // txtbxNotes
            // 
            this.txtbxNotes.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxNotes.Font = new System.Drawing.Font("Courier New", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxNotes.Location = new System.Drawing.Point(6, 351);
            this.txtbxNotes.MaxLength = 236;
            this.txtbxNotes.Multiline = true;
            this.txtbxNotes.Name = "txtbxNotes";
            this.txtbxNotes.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtbxNotes.Size = new System.Drawing.Size(639, 53);
            this.txtbxNotes.TabIndex = 33;
            // 
            // txtbxCurGpsData
            // 
            this.txtbxCurGpsData.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txtbxCurGpsData.Font = new System.Drawing.Font("Courier New", 10.2F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtbxCurGpsData.Location = new System.Drawing.Point(6, 38);
            this.txtbxCurGpsData.Name = "txtbxCurGpsData";
            this.txtbxCurGpsData.ReadOnly = true;
            this.txtbxCurGpsData.Size = new System.Drawing.Size(639, 23);
            this.txtbxCurGpsData.TabIndex = 21;
            // 
            // lblCurrGpsData
            // 
            this.lblCurrGpsData.AutoSize = true;
            this.lblCurrGpsData.Location = new System.Drawing.Point(6, 22);
            this.lblCurrGpsData.Name = "lblCurrGpsData";
            this.lblCurrGpsData.Size = new System.Drawing.Size(92, 13);
            this.lblCurrGpsData.TabIndex = 20;
            this.lblCurrGpsData.Text = "Current GPS Data";
            // 
            // lblLogFilename
            // 
            this.lblLogFilename.AutoSize = true;
            this.lblLogFilename.Location = new System.Drawing.Point(6, 109);
            this.lblLogFilename.Name = "lblLogFilename";
            this.lblLogFilename.Size = new System.Drawing.Size(78, 13);
            this.lblLogFilename.TabIndex = 26;
            this.lblLogFilename.Text = "Log File Name:";
            // 
            // menuStrip1
            // 
            this.menuStrip1.BackColor = System.Drawing.SystemColors.ControlLight;
            this.menuStrip1.ImageScalingSize = new System.Drawing.Size(20, 20);
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.settingsToolStripMenuItem,
            this.optionsToolStripMenuItem,
            this.helpToolStripMenuItem});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.RightToLeft = System.Windows.Forms.RightToLeft.No;
            this.menuStrip1.Size = new System.Drawing.Size(674, 24);
            this.menuStrip1.TabIndex = 52;
            this.menuStrip1.Text = "menuStrip1";
            // 
            // settingsToolStripMenuItem
            // 
            this.settingsToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.serialPortConfigurationToolStripMenuItem,
            this.laserFilterParametersToolStripMenuItem,
            this.gPSParametersToolStripMenuItem,
            this.customizeLogFileToolStripMenuItem});
            this.settingsToolStripMenuItem.Name = "settingsToolStripMenuItem";
            this.settingsToolStripMenuItem.Size = new System.Drawing.Size(61, 20);
            this.settingsToolStripMenuItem.Text = "Settings";
            // 
            // serialPortConfigurationToolStripMenuItem
            // 
            this.serialPortConfigurationToolStripMenuItem.Name = "serialPortConfigurationToolStripMenuItem";
            this.serialPortConfigurationToolStripMenuItem.Size = new System.Drawing.Size(204, 22);
            this.serialPortConfigurationToolStripMenuItem.Text = "Serial Port Configuration";
            this.serialPortConfigurationToolStripMenuItem.Click += new System.EventHandler(this.serialPortConfigurationToolStripMenuItem_Click);
            // 
            // laserFilterParametersToolStripMenuItem
            // 
            this.laserFilterParametersToolStripMenuItem.Name = "laserFilterParametersToolStripMenuItem";
            this.laserFilterParametersToolStripMenuItem.Size = new System.Drawing.Size(204, 22);
            this.laserFilterParametersToolStripMenuItem.Text = "Laser Filter Parameters";
            this.laserFilterParametersToolStripMenuItem.Click += new System.EventHandler(this.laserFilterParametersToolStripMenuItem_Click);
            // 
            // gPSParametersToolStripMenuItem
            // 
            this.gPSParametersToolStripMenuItem.Name = "gPSParametersToolStripMenuItem";
            this.gPSParametersToolStripMenuItem.Size = new System.Drawing.Size(204, 22);
            this.gPSParametersToolStripMenuItem.Text = "GPS Parameters";
            this.gPSParametersToolStripMenuItem.Click += new System.EventHandler(this.gPSParametersToolStripMenuItem_Click);
            // 
            // customizeLogFileToolStripMenuItem
            // 
            this.customizeLogFileToolStripMenuItem.Name = "customizeLogFileToolStripMenuItem";
            this.customizeLogFileToolStripMenuItem.Size = new System.Drawing.Size(204, 22);
            this.customizeLogFileToolStripMenuItem.Text = "Customize Log File";
            this.customizeLogFileToolStripMenuItem.Click += new System.EventHandler(this.customizeLogFileToolStripMenuItem_Click);
            // 
            // optionsToolStripMenuItem
            // 
            this.optionsToolStripMenuItem.Name = "optionsToolStripMenuItem";
            this.optionsToolStripMenuItem.Size = new System.Drawing.Size(61, 20);
            this.optionsToolStripMenuItem.Text = "Options";
            this.optionsToolStripMenuItem.Click += new System.EventHandler(this.optionsToolStripMenuItem_Click);
            // 
            // helpToolStripMenuItem
            // 
            this.helpToolStripMenuItem.Name = "helpToolStripMenuItem";
            this.helpToolStripMenuItem.Size = new System.Drawing.Size(52, 20);
            this.helpToolStripMenuItem.Text = "About";
            this.helpToolStripMenuItem.Click += new System.EventHandler(this.helpToolStripMenuItem_Click);
            // 
            // tmrUpdateFields
            // 
            this.tmrUpdateFields.Enabled = true;
            this.tmrUpdateFields.Interval = 150;
            this.tmrUpdateFields.Tick += new System.EventHandler(this.tmrUpdateFields_Tick);
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(674, 695);
            this.Controls.Add(this.grpbxData);
            this.Controls.Add(this.grpbxSetup);
            this.Controls.Add(this.menuStrip1);
            this.KeyPreview = true;
            this.MainMenuStrip = this.menuStrip1;
            this.MinimumSize = new System.Drawing.Size(690, 734);
            this.Name = "MainForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "RSA Networks:  Vertical Clearance Measurement";
            this.Activated += new System.EventHandler(this.MainForm_Activated);
            this.Load += new System.EventHandler(this.MainForm_Load);
            this.grpbxSetup.ResumeLayout(false);
            this.grpbxSetup.PerformLayout();
            this.grpbxData.ResumeLayout(false);
            this.grpbxData.PerformLayout();
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

		}

		// Token: 0x0400006F RID: 111
		private global::System.ComponentModel.IContainer components;

		// Token: 0x04000070 RID: 112
		private global::System.Windows.Forms.TextBox txtbxBaseHeight;

		// Token: 0x04000071 RID: 113
		private global::System.Windows.Forms.Label lblBaseHeight;

		// Token: 0x04000072 RID: 114
		private global::System.Windows.Forms.Button btnLaserStart;

		// Token: 0x04000073 RID: 115
		private global::System.Windows.Forms.Button btnLaserStop;

		// Token: 0x04000074 RID: 116
		private global::System.Windows.Forms.Button btnLogStart;

		// Token: 0x04000075 RID: 117
		private global::System.Windows.Forms.Button btnLogStop;

		// Token: 0x04000076 RID: 118
		private global::System.Windows.Forms.TextBox txtbxLogFilename;

		// Token: 0x04000077 RID: 119
		private global::System.Windows.Forms.Button btnResetMinimum;

		// Token: 0x04000078 RID: 120
		private global::System.Windows.Forms.Label lblCurTimeStamp;

		// Token: 0x04000079 RID: 121
		private global::System.Windows.Forms.Label lblCurLaserData;

		// Token: 0x0400007A RID: 122
		private global::System.Windows.Forms.Label lblMinHeightMeas;

		// Token: 0x0400007B RID: 123
		private global::System.Windows.Forms.TextBox txtbxCurTimeStamp;

		// Token: 0x0400007C RID: 124
		private global::System.Windows.Forms.TextBox txtbxMinHeightMeas;

		// Token: 0x0400007D RID: 125
		private global::System.Windows.Forms.GroupBox grpbxSetup;

		// Token: 0x0400007E RID: 126
		private global::System.Windows.Forms.GroupBox grpbxData;

		// Token: 0x0400007F RID: 127
		private global::System.Windows.Forms.Label lblLogFilename;

		// Token: 0x04000080 RID: 128
		public global::System.Windows.Forms.TextBox txtbxCurLaserData;

		// Token: 0x04000081 RID: 129
		private global::System.Windows.Forms.Button btnSetBaseHeight;

		// Token: 0x04000082 RID: 130
		private global::System.Windows.Forms.Label lblAlarmHeight;

		// Token: 0x04000083 RID: 131
		private global::System.Windows.Forms.Button btnSetAlarmHeight;

		// Token: 0x04000084 RID: 132
		private global::System.Windows.Forms.TextBox txtbxAlarmHeight;

		// Token: 0x04000085 RID: 133
		private global::System.Windows.Forms.Button btnChgUnits;

		// Token: 0x04000086 RID: 134
		private global::System.Windows.Forms.TextBox txtbxCurGpsData;

		// Token: 0x04000087 RID: 135
		private global::System.Windows.Forms.Label lblCurrGpsData;

		// Token: 0x04000088 RID: 136
		private global::System.Windows.Forms.Label lblNotes;

		// Token: 0x04000089 RID: 137
		private global::System.Windows.Forms.Button btnClearNotes;

		// Token: 0x0400008A RID: 138
		private global::System.Windows.Forms.TextBox txtbxNotes;

		// Token: 0x0400008B RID: 139
		private global::System.Windows.Forms.Button btnLogNotes;

		// Token: 0x0400008C RID: 140
		private global::System.Windows.Forms.MenuStrip menuStrip1;

		// Token: 0x0400008D RID: 141
		private global::System.Windows.Forms.ToolStripMenuItem settingsToolStripMenuItem;

		// Token: 0x0400008E RID: 142
		private global::System.Windows.Forms.ToolStripMenuItem serialPortConfigurationToolStripMenuItem;

		// Token: 0x0400008F RID: 143
		private global::System.Windows.Forms.ToolStripMenuItem laserFilterParametersToolStripMenuItem;

		// Token: 0x04000090 RID: 144
		private global::System.Windows.Forms.ToolStripMenuItem helpToolStripMenuItem;

		// Token: 0x04000091 RID: 145
		private global::System.Windows.Forms.ComboBox cmbobxObstructionType;

		// Token: 0x04000092 RID: 146
		private global::System.Windows.Forms.Label lblObstructionType;

		// Token: 0x04000093 RID: 147
		private global::System.Windows.Forms.Button btnClearAll;

		// Token: 0x04000094 RID: 148
		private global::System.Windows.Forms.ToolStripMenuItem gPSParametersToolStripMenuItem;

		// Token: 0x04000095 RID: 149
		private global::System.Windows.Forms.TextBox txtbxAlarmHeight2;

		// Token: 0x04000096 RID: 150
		private global::System.Windows.Forms.TextBox txtbxBaseHeight2;

		// Token: 0x04000097 RID: 151
		private global::System.Windows.Forms.Button btnClearNoteObj;

		// Token: 0x04000098 RID: 152
		private global::System.Windows.Forms.Button btnClearObject;

		// Token: 0x04000099 RID: 153
		private global::System.Windows.Forms.TextBox txtbxMaxHeight2;

		// Token: 0x0400009A RID: 154
		private global::System.Windows.Forms.Label lblMaxHeight;

		// Token: 0x0400009B RID: 155
		private global::System.Windows.Forms.Button btnSetMaxHeight;

		// Token: 0x0400009C RID: 156
		private global::System.Windows.Forms.TextBox txtbxMaxHeight;

		// Token: 0x0400009D RID: 157
		private global::System.Windows.Forms.Button btnResetMinNoLog;

		// Token: 0x0400009E RID: 158
		private global::System.Windows.Forms.Button btnClearAllNoLog;

		// Token: 0x0400009F RID: 159
		private global::System.Windows.Forms.ListBox lstbxLogEntries;

		// Token: 0x040000A0 RID: 160
		private global::System.Windows.Forms.Button btnManualLogEntry;

		// Token: 0x040000A1 RID: 161
		private global::System.Windows.Forms.Timer tmrUpdateFields;

		// Token: 0x040000A2 RID: 162
		private global::System.Windows.Forms.Label lblTemperature;

		// Token: 0x040000A3 RID: 163
		private global::System.Windows.Forms.TextBox txtbxTemperature;

		// Token: 0x040000A4 RID: 164
		private global::System.Windows.Forms.Label lblRouteSegment;

		// Token: 0x040000A5 RID: 165
		private global::System.Windows.Forms.TextBox txtbxRouteSegment;

		// Token: 0x040000A6 RID: 166
		private global::System.Windows.Forms.ToolStripMenuItem optionsToolStripMenuItem;

		// Token: 0x040000A7 RID: 167
		private global::System.Windows.Forms.Label lblCurrentLoggingMode;

		// Token: 0x040000A8 RID: 168
		private global::System.Windows.Forms.ComboBox cmbobxCurrentLoggingMode;

		// Token: 0x040000A9 RID: 169
		private global::System.Windows.Forms.ToolTip tooltipLaserTestForm;

		// Token: 0x040000AA RID: 170
		private global::System.Windows.Forms.Label lblInsufficientSatellites;

		// Token: 0x040000AB RID: 171
		private global::System.Windows.Forms.Label lblLaserQueueDepth;

		// Token: 0x040000AC RID: 172
		private global::System.Windows.Forms.Label lblGpsQueueDepth;

		// Token: 0x040000AD RID: 173
		private global::System.Windows.Forms.Label lblGpsQueue;

		// Token: 0x040000AE RID: 174
		private global::System.Windows.Forms.Label lblLaserQueue;

		// Token: 0x040000AF RID: 175
		private global::System.Windows.Forms.ToolStripMenuItem customizeLogFileToolStripMenuItem;
	}
}
