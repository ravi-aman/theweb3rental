'use client';
import useGrokUrl from 'utils/getGrokUrl';

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Flex,
  FormLabel,
  Image,
  Icon,
  Select,
  SimpleGrid,
  useColorModeValue,
  Text,
  Tooltip,
} from '@chakra-ui/react';
// Custom components
import MiniStatistics from 'components/card/MiniStatistics';
import IconBox from 'components/icons/IconBox';
import {
  MdAddTask,
  MdAttachMoney,
  MdBarChart,
  MdFileCopy,
  MdMemory,
  MdStorage,
  MdSpeed,
  MdDeveloperBoard,
} from 'react-icons/md';
import { FaServer, FaMicrochip, FaMemory } from 'react-icons/fa';
import CheckTable from 'views/admin/default/components/CheckTable';
import ComplexTable from 'views/admin/default/components/ComplexTable';
import DailyTraffic from 'views/admin/default/components/DailyTraffic';
import PieCard from 'views/admin/default/components/PieCard';
import Tasks from 'views/admin/default/components/Tasks';
import TotalSpent from 'views/admin/default/components/TotalSpent';
import WeeklyRevenue from 'views/admin/default/components/WeeklyRevenue';
import tableDataCheck from 'views/admin/default/variables/tableDataCheck';
import tableDataComplex from 'views/admin/default/variables/tableDataComplex';
// Assets
import Usa from 'img/dashboards/usa.png';

export default function Default() {
  // Chakra Color Mode
  const brandColor = useColorModeValue('brand.500', 'white');
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const WS_URL = useGrokUrl();
  const successColor = useColorModeValue('green.500', 'green.400');
  const warningColor = useColorModeValue('yellow.500', 'yellow.400');
  const errorColor = useColorModeValue('red.500', 'red.400');

  // WebSocket and state management
  const [connected, setConnected] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    OS: "",
    CPU: "",
    Cores: 0,
    Threads: 0,
    RAM: 0,
    GPU: []
  });
  const [usageStats, setUsageStats] = useState({
    CPU_Usage: 0,
    Memory_Usage: 0,
    Disk_Usage: 0,
    Download_Speed: 0,
    Upload_Speed: 0,
    GPU_Usage: 0,
    GPU_Memory_Usage: 0
  });
  const wsRef = useRef(null);

  // Function to connect to WebSocket
  const connectWebSocket = () => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
      setConnected(true);

      // Request system information when connection is established
      ws.send(JSON.stringify({ event: 'request_system_info' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle system_info updates
      if (data.system_info) {
        setSystemInfo(data.system_info);
        console.log('Received system info:', data.system_info);
      }

      // Handle usage_stats updates
      if (data.usage_stats) {
        setUsageStats(data.usage_stats);
        console.log('Received usage stats:', data.usage_stats);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  };

  // Establish WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Helper function to determine color based on usage percentage
  const getUsageColor = (usage: number) => {
    if (usage > 80) return errorColor;
    if (usage > 60) return warningColor;
    return successColor;
  };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      {/* Connection Status Indicator */}
      <Flex mb="10px" align="center">
        <Box
          w="10px"
          h="10px"
          borderRadius="full"
          bg={connected ? successColor : errorColor}
          mr="2"
        />
        <Text fontSize="sm">
          {connected ? 'Connected to System Monitor' : 'Disconnected - Attempting to reconnect...'}
        </Text>
      </Flex>

      {/* System Information Statistics */}
      <Box mb="20px">
        <Text fontWeight="bold" fontSize="xl" mb="10px">System Information</Text>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, '2xl': 6 }} gap="20px" mb="20px">
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={FaServer} color={brandColor} />}
              />
            }
            name="Operating System"
            value={systemInfo.OS || "Unknown"}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={FaMicrochip} color={brandColor} />}
              />
            }
            name="CPU Cores / Threads"
            value={`${systemInfo.Cores || 0} / ${systemInfo.Threads || 0}`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={FaMemory} color={brandColor} />}
              />
            }
            name="Total RAM"
            value={`${systemInfo.RAM?.toFixed(2) || 0} GB`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={MdDeveloperBoard} color={brandColor} />}
              />
            }
            name="GPU"
            value={systemInfo.GPU && systemInfo.GPU.length > 0
              ? systemInfo.GPU[0].Name
              : "No GPU"}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={MdMemory} color={brandColor} />}
              />
            }
            name="GPU Memory"
            value={systemInfo.GPU && systemInfo.GPU.length > 0
              ? `${(systemInfo.GPU[0].Memory / 1024).toFixed(2)} GB`
              : "N/A"}
          />
          <Tooltip label={systemInfo.CPU} placement="top">
            <Box>
              <MiniStatistics
                startContent={
                  <IconBox
                    w="56px"
                    h="56px"
                    bg={boxBg}
                    icon={<Icon w="32px" h="32px" as={MdSpeed} color={brandColor} />}
                  />
                }
                name="CPU Model"
                value="View Details"
              />
            </Box>
          </Tooltip>
        </SimpleGrid>
      </Box>

      {/* Usage Statistics */}
      <Box mb="20px">
        <Text fontWeight="bold" fontSize="xl" mb="10px">Real-time Usage</Text>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, '2xl': 6 }} gap="20px" mb="20px">
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon
                    w="32px"
                    h="32px"
                    as={FaMicrochip}
                    color={getUsageColor(usageStats.CPU_Usage)}
                  />
                }
              />
            }
            name="CPU Usage"
            value={`${usageStats.CPU_Usage?.toFixed(1) || 0}%`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon
                    w="32px"
                    h="32px"
                    as={FaMemory}
                    color={getUsageColor(usageStats.Memory_Usage)}
                  />
                }
              />
            }
            name="Memory Usage"
            value={`${usageStats.Memory_Usage?.toFixed(1) || 0}%`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon
                    w="32px"
                    h="32px"
                    as={MdStorage}
                    color={getUsageColor(usageStats.Disk_Usage)}
                  />
                }
              />
            }
            name="Disk Usage"
            value={`${usageStats.Disk_Usage?.toFixed(1) || 0}%`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={MdBarChart} color={brandColor} />}
              />
            }
            name="Network Download"
            value={`${usageStats.Download_Speed?.toFixed(2) || 0} Mbps`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={<Icon w="32px" h="32px" as={MdBarChart} color={brandColor} />}
              />
            }
            name="Network Upload"
            value={`${usageStats.Upload_Speed?.toFixed(2) || 0} Mbps`}
          />
          <MiniStatistics
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon
                    w="32px"
                    h="32px"
                    as={MdDeveloperBoard}
                    color={getUsageColor(usageStats.GPU_Usage)}
                  />
                }
              />
            }
            name="GPU Usage"
            value={`${usageStats.GPU_Usage?.toFixed(1) || 0}%`}
          />
        </SimpleGrid>
      </Box>

      {/* Original Dashboard Content */}
      <Text fontWeight="bold" fontSize="xl" mb="10px">Business Metrics</Text>
      <SimpleGrid
        columns={{ base: 1, md: 2, lg: 3, '2xl': 6 }}
        gap="20px"
        mb="20px"
      >
        <MiniStatistics
          startContent={
            <IconBox
              w="56px"
              h="56px"
              bg={boxBg}
              icon={
                <Icon w="32px" h="32px" as={MdBarChart} color={brandColor} />
              }
            />
          }
          name="Earnings"
          value="$350.4"
        />
        <MiniStatistics
          startContent={
            <IconBox
              w="56px"
              h="56px"
              bg={boxBg}
              icon={
                <Icon w="32px" h="32px" as={MdAttachMoney} color={brandColor} />
              }
            />
          }
          name="Spend this month"
          value="$642.39"
        />
        <MiniStatistics growth="+23%" name="Sales" value="$574.34" />
        <MiniStatistics
          endContent={
            <Flex me="-16px" mt="10px">
              <FormLabel htmlFor="balance">
                <Box boxSize={'12'}>
                  <Image alt="" src={Usa.src} w={'100%'} h={'100%'} />
                </Box>
              </FormLabel>
              <Select
                id="balance"
                variant="mini"
                mt="5px"
                me="0px"
                defaultValue="usd"
              >
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
                <option value="gba">GBA</option>
              </Select>
            </Flex>
          }
          name="Your balance"
          value="$1,000"
        />
        <MiniStatistics
          startContent={
            <IconBox
              w="56px"
              h="56px"
              bg="linear-gradient(90deg, #4481EB 0%, #04BEFE 100%)"
              icon={<Icon w="28px" h="28px" as={MdAddTask} color="white" />}
            />
          }
          name="New Tasks"
          value="154"
        />
        <MiniStatistics
          startContent={
            <IconBox
              w="56px"
              h="56px"
              bg={boxBg}
              icon={
                <Icon w="32px" h="32px" as={MdFileCopy} color={brandColor} />
              }
            />
          }
          name="Total Projects"
          value="2935"
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap="20px" mb="20px">
        <TotalSpent />
        <WeeklyRevenue />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 1, xl: 2 }} gap="20px" mb="20px">
        <CheckTable tableData={tableDataCheck} />
        <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap="20px">
          <DailyTraffic />
          <PieCard />
        </SimpleGrid>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 1, xl: 2 }} gap="20px" mb="20px">
        <ComplexTable tableData={tableDataComplex} />
        <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap="20px">
          <Tasks />
        </SimpleGrid>
      </SimpleGrid>
    </Box>
  );
}