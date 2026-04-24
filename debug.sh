#!/bin/bash
# Debug script for CSV Table Viewer Extension

echo "🚀 Launching VS Code in Extension Development Mode..."
echo ""
echo "When VS Code opens:"
echo "1. It will open with the extension loaded in debug mode"
echo "2. A test.csv file will be in the editor"
echo "3. Press F5 to attach the debugger"
echo "4. Open the Output panel (Ctrl+Shift+U) and select 'CSV/XLS Table Viewer'"
echo "5. You'll see all the console.log() debug messages"
echo ""

code --extensionDevelopmentPath=. test.csv
