#!/bin/bash

# macOS App Screenshot Script
# Usage: ./screenshot_app.sh "App Name"
# Example: ./screenshot_app.sh "Visual Studio Code"

set -euo pipefail

# Check if app name is provided
if [ $# -eq 0 ]; then
    echo "❌ Error: No app name provided"
    echo "Usage: $0 \"App Name\""
    echo "Example: $0 \"Visual Studio Code\""
    exit 1
fi

APP_NAME="$1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SCREENSHOT_DIR="$HOME/Desktop/Screenshots"

# Create screenshots directory if it doesn't exist
mkdir -p "$SCREENSHOT_DIR"

echo "🔍 Looking for app: $APP_NAME"

# Try to find the app with case-insensitive matching first
ACTUAL_APP_NAME=$(osascript << EOF
try
    tell application "System Events"
        set allProcesses to name of every process whose background only is false
        repeat with processName in allProcesses
            if (processName as string) contains "$APP_NAME" or ("$APP_NAME" as string) contains (processName as string) then
                return processName as string
            end if
        end repeat
        -- Try exact case-insensitive match
        repeat with processName in allProcesses
            if (processName as string) is equal to "$APP_NAME" then
                return processName as string
            end if
        end repeat
        return "NOT_FOUND"
    end tell
on error errorMessage
    return "ERROR: " & errorMessage
end try
EOF
)

# If we couldn't find a match, try partial matching
if [[ "$ACTUAL_APP_NAME" == "NOT_FOUND" ]]; then
    ACTUAL_APP_NAME=$(osascript << EOF
try
    tell application "System Events"
        set allProcesses to name of every process whose background only is false
        repeat with processName in allProcesses
            set lowerProcessName to do shell script "echo " & quoted form of (processName as string) & " | tr '[:upper:]' '[:lower:]'"
            set lowerSearchName to do shell script "echo " & quoted form of "$APP_NAME" & " | tr '[:upper:]' '[:lower:]'"
            if lowerProcessName contains lowerSearchName or lowerSearchName contains lowerProcessName then
                return processName as string
            end if
        end repeat
        return "NOT_FOUND"
    end tell
on error errorMessage
    return "ERROR: " & errorMessage
end try
EOF
)
fi

# Check if we found the app
if [[ "$ACTUAL_APP_NAME" == "NOT_FOUND" ]] || [[ "$ACTUAL_APP_NAME" == ERROR:* ]]; then
    echo "❌ Could not find app '$APP_NAME'"
    echo "💡 Make sure the app is running and try one of these:"
    echo ""
    echo "Available running apps:"
    osascript -e 'tell application "System Events" to get name of every process whose background only is false' | tr ',' '\n' | sed 's/^ */• /'
    exit 1
fi

echo "✅ Found app: $ACTUAL_APP_NAME"

# Now that we have the actual app name, construct the filename
FILENAME="${SCREENSHOT_DIR}/screenshot_${ACTUAL_APP_NAME// /_}_${TIMESTAMP}.png"

# Try to get window info and use different capture methods
WINDOW_INFO=$(osascript << EOF
try
    tell application "System Events"
        set appProcess to first process whose name is "$ACTUAL_APP_NAME"
        set windowCount to count of windows of appProcess
        if windowCount > 0 then
            set frontWindow to first window of appProcess
            try
                set windowID to id of frontWindow
                return "WINDOW_ID:" & windowID
            on error
                set windowBounds to position of frontWindow & size of frontWindow
                return "BOUNDS:" & (item 1 of windowBounds) & "," & (item 2 of windowBounds) & "," & (item 3 of windowBounds) & "," & (item 4 of windowBounds)
            end try
        else
            return "NO_WINDOWS"
        end if
    end tell
on error errorMessage
    return "ERROR: " & errorMessage
end try
EOF
)

echo "🔍 Window info: $WINDOW_INFO"

# Bring the app to front first
osascript << EOF
tell application "System Events"
    set frontmost of first process whose name is "$ACTUAL_APP_NAME" to true
end tell
delay 1
EOF

echo "📸 Taking screenshot..."

# Determine capture method based on WINDOW_STRATEGY environment variable
STRATEGY="${WINDOW_STRATEGY:-auto}"
echo "🎯 Using window strategy: $STRATEGY"

case "$STRATEGY" in
    "id")
        # Force window ID method
        if [[ "$WINDOW_INFO" == WINDOW_ID:* ]]; then
            WINDOW_ID=${WINDOW_INFO#WINDOW_ID:}
            echo "✅ Using window ID method (ID: $WINDOW_ID)"
            screencapture -l "$WINDOW_ID" -o "$FILENAME"
        else
            echo "⚠️  Window ID not available, falling back to frontmost window"
            screencapture -w -o "$FILENAME"
        fi
        ;;
    "bounds")
        # Force bounds method
        if [[ "$WINDOW_INFO" == BOUNDS:* ]]; then
            BOUNDS=${WINDOW_INFO#BOUNDS:}
            IFS=',' read -r x y w h <<< "$BOUNDS"
            echo "✅ Using bounds method (${x},${y} ${w}x${h})"
            screencapture -R "${x},${y},${w},${h}" -o "$FILENAME"
        else
            echo "⚠️  Window bounds not available, falling back to frontmost window"
            screencapture -w -o "$FILENAME"
        fi
        ;;
    "interactive")
        # Force interactive selection
        echo "🖱️  Starting interactive selection..."
        echo "💡 Click on the app window or area you want to capture when the crosshair appears"
        screencapture -i -o "$FILENAME"
        ;;
    "auto"|*)
        # Auto mode - try different capture methods based on what we found
        if [[ "$WINDOW_INFO" == WINDOW_ID:* ]]; then
            # Extract window ID and use it
            WINDOW_ID=${WINDOW_INFO#WINDOW_ID:}
            echo "✅ Using window ID method (ID: $WINDOW_ID)"
            screencapture -l "$WINDOW_ID" -o "$FILENAME"
        elif [[ "$WINDOW_INFO" == BOUNDS:* ]]; then
            # Extract bounds and use region capture
            BOUNDS=${WINDOW_INFO#BOUNDS:}
            IFS=',' read -r x y w h <<< "$BOUNDS"
            echo "✅ Using bounds method (${x},${y} ${w}x${h})"
            screencapture -R "${x},${y},${w},${h}" -o "$FILENAME"
        elif [[ "$WINDOW_INFO" == "NO_WINDOWS" ]]; then
            # App might be a menu bar app or have no windows - try interactive selection
            echo "⚠️  App has no windows. Starting interactive selection..."
            echo "💡 Click on the app window or area you want to capture when the crosshair appears"
            screencapture -i -o "$FILENAME"
        else
            # Fallback: try to capture the frontmost window
            echo "⚠️  Falling back to frontmost window capture"
            screencapture -w -o "$FILENAME"
        fi
        ;;
esac

if [ -f "$FILENAME" ]; then
    echo "📸 Screenshot saved: $FILENAME"

    # Optional compression with COMPRESS=1 environment variable
    if [ "${COMPRESS:-}" = "1" ]; then
        echo "🗜️  Compressing PNG file..."
        ORIGINAL_SIZE=$(stat -f%z "$FILENAME")

        # Use sips to optimize PNG compression
        # Create a temporary file for compression
        TEMP_PNG="${FILENAME%.png}_temp.png"
        if sips -s format png --setProperty formatOptions default "$FILENAME" --out "$TEMP_PNG" &>/dev/null && \
           mv "$TEMP_PNG" "$FILENAME" &>/dev/null; then
            COMPRESSED_SIZE=$(stat -f%z "$FILENAME")
            SAVINGS=$((ORIGINAL_SIZE - COMPRESSED_SIZE))
            PERCENTAGE=$((SAVINGS * 100 / ORIGINAL_SIZE))
            echo "✅ Compression complete: ${ORIGINAL_SIZE} bytes → ${COMPRESSED_SIZE} bytes (saved ${SAVINGS} bytes, ${PERCENTAGE}%)"
        else
            echo "⚠️  Compression failed, using original file"
        fi
    fi

    echo "🎉 Done!"
else
    echo "❌ Failed to capture screenshot"
    exit 1
fi
