using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Resources;
using System.Runtime.CompilerServices;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000017 RID: 23
	[GeneratedCode("System.Resources.Tools.StronglyTypedResourceBuilder", "4.0.0.0")]
	[DebuggerNonUserCode]
	[CompilerGenerated]
	internal class Resource1
	{
		// Token: 0x060000C4 RID: 196 RVA: 0x0000CF0A File Offset: 0x0000B10A
		internal Resource1()
		{
		}

		// Token: 0x17000026 RID: 38
		// (get) Token: 0x060000C5 RID: 197 RVA: 0x0000CF12 File Offset: 0x0000B112
		[EditorBrowsable(EditorBrowsableState.Advanced)]
		internal static ResourceManager ResourceManager
		{
			get
			{
				if (Resource1.resourceMan == null)
				{
					Resource1.resourceMan = new ResourceManager("RSA_Laser_Test_App.Resource1", typeof(Resource1).Assembly);
				}
				return Resource1.resourceMan;
			}
		}

		// Token: 0x17000027 RID: 39
		// (get) Token: 0x060000C6 RID: 198 RVA: 0x0000CF3E File Offset: 0x0000B13E
		// (set) Token: 0x060000C7 RID: 199 RVA: 0x0000CF45 File Offset: 0x0000B145
		[EditorBrowsable(EditorBrowsableState.Advanced)]
		internal static CultureInfo Culture
		{
			get
			{
				return Resource1.resourceCulture;
			}
			set
			{
				Resource1.resourceCulture = value;
			}
		}

		// Token: 0x17000028 RID: 40
		// (get) Token: 0x060000C8 RID: 200 RVA: 0x0000CF4D File Offset: 0x0000B14D
		internal static UnmanagedMemoryStream ALARME2
		{
			get
			{
				return Resource1.ResourceManager.GetStream("ALARME2", Resource1.resourceCulture);
			}
		}

		// Token: 0x17000029 RID: 41
		// (get) Token: 0x060000C9 RID: 201 RVA: 0x0000CF63 File Offset: 0x0000B163
		internal static UnmanagedMemoryStream BEEPDOUB
		{
			get
			{
				return Resource1.ResourceManager.GetStream("BEEPDOUB", Resource1.resourceCulture);
			}
		}

		// Token: 0x1700002A RID: 42
		// (get) Token: 0x060000CA RID: 202 RVA: 0x0000CF79 File Offset: 0x0000B179
		internal static UnmanagedMemoryStream bizniss_horn
		{
			get
			{
				return Resource1.ResourceManager.GetStream("bizniss_horn", Resource1.resourceCulture);
			}
		}

		// Token: 0x1700002B RID: 43
		// (get) Token: 0x060000CB RID: 203 RVA: 0x0000CF8F File Offset: 0x0000B18F
		internal static UnmanagedMemoryStream jobro_1_alarm
		{
			get
			{
				return Resource1.ResourceManager.GetStream("jobro_1_alarm", Resource1.resourceCulture);
			}
		}

		// Token: 0x1700002C RID: 44
		// (get) Token: 0x060000CC RID: 204 RVA: 0x0000CFA5 File Offset: 0x0000B1A5
		internal static UnmanagedMemoryStream Windows7GardenDing
		{
			get
			{
				return Resource1.ResourceManager.GetStream("Windows7GardenDing", Resource1.resourceCulture);
			}
		}

		// Token: 0x04000125 RID: 293
		private static ResourceManager resourceMan;

		// Token: 0x04000126 RID: 294
		private static CultureInfo resourceCulture;
	}
}
