using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    static int Main(string[] args)
    {
        if (args.Length < 4)
        {
            Console.Error.WriteLine("Usage: snidge-screenshot <x> <y> <physWidth> <physHeight>");
            return 1;
        }

        if (!int.TryParse(args[0], out int x) ||
            !int.TryParse(args[1], out int y) ||
            !int.TryParse(args[2], out int w) ||
            !int.TryParse(args[3], out int h))
        {
            Console.Error.WriteLine("Invalid arguments");
            return 1;
        }

        // DPI awareness so CopyFromScreen works in physical pixels
        SetProcessDPIAware();

        using var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(bmp);
        g.CopyFromScreen(x, y, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);

        using var ms = new MemoryStream();
        bmp.Save(ms, ImageFormat.Png);

        var bytes = ms.ToArray();
        using var stdout = Console.OpenStandardOutput();
        stdout.Write(bytes, 0, bytes.Length);
        stdout.Flush();

        return 0;
    }
}
