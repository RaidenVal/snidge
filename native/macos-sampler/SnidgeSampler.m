#import <AppKit/AppKit.h>
#import <math.h>

static int componentToByte(CGFloat component) {
  CGFloat clamped = fmax(0.0, fmin(1.0, component));
  return (int)lrint(clamped * 255.0);
}

static NSString *hexStringFromColor(NSColor *color) {
  NSColor *srgbColor = [color colorUsingColorSpace:[NSColorSpace sRGBColorSpace]];
  if (srgbColor == nil) {
    return nil;
  }

  CGFloat red = 0.0;
  CGFloat green = 0.0;
  CGFloat blue = 0.0;
  [srgbColor getRed:&red green:&green blue:&blue alpha:NULL];

  return [NSString stringWithFormat:@"#%02X%02X%02X",
                                    componentToByte(red),
                                    componentToByte(green),
                                    componentToByte(blue)];
}

int main(void) {
  @autoreleasepool {
    NSApplication *app = [NSApplication sharedApplication];
    [app setActivationPolicy:NSApplicationActivationPolicyAccessory];
    [app activateIgnoringOtherApps:YES];

    dispatch_async(dispatch_get_main_queue(), ^{
      NSColorSampler *sampler = [[NSColorSampler alloc] init];
      [sampler showSamplerWithSelectionHandler:^(NSColor *selectedColor) {
        if (selectedColor == nil) {
          exit(2);
        }

        NSString *hex = hexStringFromColor(selectedColor);
        if (hex == nil) {
          exit(3);
        }

        printf("%s\n", [hex UTF8String]);
        fflush(stdout);
        [NSApp terminate:nil];
      }];
    });

    [app run];
  }

  return 0;
}
